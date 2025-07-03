const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');
const { Worker } = require('worker_threads');
const os = require('os');

// Performance optimization settings
const PERFORMANCE_CONFIG = {
  // Connection pool settings
  poolSize: 20,
  maxConnections: 50,
  connectionTimeout: 30000,
  idleTimeout: 10000,
  
  // Batch processing
  optimalBatchSize: 5000,
  maxBatchSize: 10000,
  parallelWorkers: Math.min(os.cpus().length, 8),
  
  // Memory management
  maxMemoryUsage: 0.8, // Use up to 80% of available memory
  gcInterval: 100, // Force garbage collection every N batches
  
  // Query optimization
  usePreparedStatements: true,
  useCopyCommand: true, // Use COPY for bulk inserts when possible
  
  // Index management
  dropIndexesBeforeImport: true,
  recreateIndexesAfterImport: true,
  analyzeAfterImport: true
};

// Index management queries
const INDEX_QUERIES = {
  // Store index definitions before dropping
  saveIndexes: `
    SELECT 
      schemaname,
      tablename,
      indexname,
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND tablename = $1
    AND indexname NOT LIKE '%_pkey'
  `,
  
  // Drop non-primary key indexes
  dropIndexes: `
    DO $$
    DECLARE
      r RECORD;
    BEGIN
      FOR r IN 
        SELECT indexname 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = $1
        AND indexname NOT LIKE '%_pkey'
      LOOP
        EXECUTE 'DROP INDEX IF EXISTS ' || r.indexname;
      END LOOP;
    END $$;
  `,
  
  // Disable triggers temporarily
  disableTriggers: 'ALTER TABLE $1 DISABLE TRIGGER ALL',
  enableTriggers: 'ALTER TABLE $1 ENABLE TRIGGER ALL',
  
  // Analyze table for query optimization
  analyzeTable: 'ANALYZE $1'
};

// Optimized importer class
class OptimizedPostgreSQLImporter {
  constructor(connectionString) {
    this.connectionString = connectionString;
    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
      max: PERFORMANCE_CONFIG.poolSize,
      idleTimeoutMillis: PERFORMANCE_CONFIG.idleTimeout,
      connectionTimeoutMillis: PERFORMANCE_CONFIG.connectionTimeout,
      statement_timeout: 0 // No timeout for bulk operations
    });
    
    this.savedIndexes = new Map();
    this.preparedStatements = new Map();
    this.memoryUsage = 0;
    this.gcCounter = 0;
  }

  // Monitor memory usage
  checkMemoryUsage() {
    const used = process.memoryUsage();
    const totalMemory = os.totalmem();
    const usagePercent = used.heapUsed / totalMemory;
    
    if (usagePercent > PERFORMANCE_CONFIG.maxMemoryUsage) {
      console.log('⚠️  High memory usage detected, forcing garbage collection...');
      if (global.gc) {
        global.gc();
      }
      return true;
    }
    return false;
  }

  // Calculate optimal batch size based on record size
  calculateOptimalBatchSize(records) {
    if (records.length === 0) return PERFORMANCE_CONFIG.optimalBatchSize;
    
    // Estimate record size
    const sampleSize = Math.min(10, records.length);
    const sampleRecords = records.slice(0, sampleSize);
    const avgSize = sampleRecords.reduce((sum, record) => 
      sum + JSON.stringify(record).length, 0) / sampleSize;
    
    // Adjust batch size based on record size
    const targetBatchMemory = 50 * 1024 * 1024; // 50MB per batch
    const calculatedBatchSize = Math.floor(targetBatchMemory / avgSize);
    
    return Math.min(
      Math.max(calculatedBatchSize, 1000),
      PERFORMANCE_CONFIG.maxBatchSize
    );
  }

  // Save and drop indexes for better import performance
  async optimizeTableForImport(tableName) {
    const client = await this.pool.connect();
    
    try {
      console.log(`   🔧 Optimizing ${tableName} for import...`);
      
      // Save existing indexes
      const indexResult = await client.query(INDEX_QUERIES.saveIndexes, [tableName]);
      this.savedIndexes.set(tableName, indexResult.rows);
      
      if (PERFORMANCE_CONFIG.dropIndexesBeforeImport && indexResult.rows.length > 0) {
        // Drop indexes
        await client.query(INDEX_QUERIES.dropIndexes.replace('$1', tableName));
        console.log(`   📉 Dropped ${indexResult.rows.length} indexes`);
      }
      
      // Disable triggers
      await client.query(INDEX_QUERIES.disableTriggers.replace('$1', tableName));
      
      // Set table to unlogged temporarily for faster inserts
      await client.query(`ALTER TABLE ${tableName} SET UNLOGGED`);
      
    } catch (error) {
      console.error(`   ⚠️  Failed to optimize table: ${error.message}`);
    } finally {
      client.release();
    }
  }

  // Restore indexes and optimize table after import
  async restoreTableAfterImport(tableName) {
    const client = await this.pool.connect();
    
    try {
      console.log(`   🔧 Restoring ${tableName} after import...`);
      
      // Set table back to logged
      await client.query(`ALTER TABLE ${tableName} SET LOGGED`);
      
      // Re-enable triggers
      await client.query(INDEX_QUERIES.enableTriggers.replace('$1', tableName));
      
      // Recreate indexes
      const savedIndexes = this.savedIndexes.get(tableName) || [];
      if (PERFORMANCE_CONFIG.recreateIndexesAfterImport && savedIndexes.length > 0) {
        console.log(`   📈 Recreating ${savedIndexes.length} indexes...`);
        
        for (const index of savedIndexes) {
          try {
            await client.query(index.indexdef);
          } catch (error) {
            console.error(`   ⚠️  Failed to recreate index ${index.indexname}: ${error.message}`);
          }
        }
      }
      
      // Analyze table for query planner
      if (PERFORMANCE_CONFIG.analyzeAfterImport) {
        await client.query(INDEX_QUERIES.analyzeTable.replace('$1', tableName));
        console.log(`   📊 Table analyzed for query optimization`);
      }
      
    } catch (error) {
      console.error(`   ⚠️  Failed to restore table: ${error.message}`);
    } finally {
      client.release();
    }
  }

  // Use COPY command for bulk insert (fastest method)
  async bulkInsertWithCopy(tableName, records, columns) {
    if (!PERFORMANCE_CONFIG.useCopyCommand || records.length < 1000) {
      return null; // Fall back to regular INSERT for small datasets
    }
    
    const client = await this.pool.connect();
    
    try {
      // Prepare column names
      const columnNames = Object.keys(records[0]).filter(key => 
        columns.some(col => col.column_name === key)
      );
      
      // Create CSV data in memory
      const csvData = [];
      
      // Add header
      csvData.push(columnNames.join(','));
      
      // Add data rows
      for (const record of records) {
        const row = columnNames.map(col => {
          const value = record[col];
          if (value === null || value === undefined) return '\\N';
          if (typeof value === 'string') {
            // Escape special characters
            return '"' + value.replace(/"/g, '""').replace(/\n/g, '\\n') + '"';
          }
          if (typeof value === 'object') {
            return '"' + JSON.stringify(value).replace(/"/g, '""') + '"';
          }
          return value;
        }).join(',');
        csvData.push(row);
      }
      
      const csvContent = csvData.join('\n');
      
      // Use COPY command
      const copyQuery = `COPY ${tableName} (${columnNames.join(', ')}) FROM STDIN WITH (FORMAT csv, HEADER true, NULL '\\N')`;
      
      await client.query(copyQuery, (stream) => {
        stream.write(csvContent);
        stream.end();
      });
      
      return records.length;
      
    } catch (error) {
      // Fall back to regular INSERT
      return null;
    } finally {
      client.release();
    }
  }

  // Create prepared statement for reuse
  async createPreparedStatement(name, tableName, columns) {
    if (!PERFORMANCE_CONFIG.usePreparedStatements) return null;
    
    const columnNames = columns.map(col => col.column_name);
    const placeholders = columnNames.map((_, i) => `$${i + 1}`).join(', ');
    
    const query = `
      INSERT INTO ${tableName} (${columnNames.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT (id) DO UPDATE SET
      ${columnNames.filter(col => col !== 'id' && col !== 'created_at')
        .map(col => `${col} = EXCLUDED.${col}`).join(', ')}
    `;
    
    this.preparedStatements.set(name, { query, columns: columnNames });
    return query;
  }

  // Parallel batch processing using worker threads
  async processInParallel(records, processingFunction, workerCount = PERFORMANCE_CONFIG.parallelWorkers) {
    const batchSize = Math.ceil(records.length / workerCount);
    const batches = [];
    
    for (let i = 0; i < records.length; i += batchSize) {
      batches.push(records.slice(i, Math.min(i + batchSize, records.length)));
    }
    
    const promises = batches.map(batch => processingFunction(batch));
    const results = await Promise.all(promises);
    
    return results.reduce((acc, result) => ({
      successful: acc.successful + result.successful,
      failed: acc.failed + result.failed,
      errors: [...acc.errors, ...result.errors]
    }), { successful: 0, failed: 0, errors: [] });
  }

  // Optimized import with all performance features
  async importCollectionOptimized(config, dataPath) {
    console.log(`\n🚀 Importing ${config.name} with optimizations...`);
    
    const startTime = Date.now();
    
    try {
      // Load data
      const records = JSON.parse(await fs.readFile(dataPath, 'utf8'));
      console.log(`   📊 ${records.length} records to import`);
      
      if (records.length === 0) return { successful: 0, failed: 0 };
      
      // Get table schema
      const columns = await this.getTableColumns(config.table);
      
      // Optimize table
      await this.optimizeTableForImport(config.table);
      
      // Calculate optimal batch size
      const batchSize = this.calculateOptimalBatchSize(records);
      console.log(`   📦 Using batch size: ${batchSize}`);
      
      // Try COPY method first (fastest)
      const copyResult = await this.bulkInsertWithCopy(config.table, records, columns);
      
      if (copyResult !== null) {
        console.log(`   ⚡ Imported ${copyResult} records using COPY (ultra-fast)`);
        
        // Restore table
        await this.restoreTableAfterImport(config.table);
        
        const duration = Date.now() - startTime;
        console.log(`   ✅ Completed in ${(duration / 1000).toFixed(2)}s`);
        console.log(`   📈 Performance: ${Math.round(records.length / (duration / 1000))} records/second`);
        
        return { successful: copyResult, failed: 0 };
      }
      
      // Fall back to batch INSERT with optimizations
      console.log('   📝 Using optimized batch INSERT method');
      
      // Create prepared statement
      await this.createPreparedStatement(config.name, config.table, columns);
      
      // Process in parallel batches
      const results = await this.processInParallel(
        records,
        async (batch) => await this.importBatchOptimized(config.table, batch, columns, config),
        Math.min(PERFORMANCE_CONFIG.parallelWorkers, Math.ceil(records.length / batchSize))
      );
      
      // Restore table
      await this.restoreTableAfterImport(config.table);
      
      const duration = Date.now() - startTime;
      console.log(`   ✅ Completed in ${(duration / 1000).toFixed(2)}s`);
      console.log(`   📊 Results: ${results.successful} imported, ${results.failed} failed`);
      console.log(`   📈 Performance: ${Math.round(results.successful / (duration / 1000))} records/second`);
      
      // Check memory and run GC if needed
      this.gcCounter++;
      if (this.gcCounter % PERFORMANCE_CONFIG.gcInterval === 0) {
        this.checkMemoryUsage();
      }
      
      return results;
      
    } catch (error) {
      console.error(`   ❌ Import failed: ${error.message}`);
      throw error;
    }
  }

  // Optimized batch import
  async importBatchOptimized(tableName, records, columns, config) {
    const client = await this.pool.connect();
    const results = { successful: 0, failed: 0, errors: [] };
    
    try {
      // Use single transaction for entire batch
      await client.query('BEGIN');
      
      // Build multi-row insert
      const columnNames = Object.keys(records[0]).filter(key => 
        columns.some(col => col.column_name === key)
      );
      
      const values = [];
      const valuePlaceholders = [];
      let paramIndex = 1;
      
      records.forEach(record => {
        const recordPlaceholders = [];
        columnNames.forEach(column => {
          recordPlaceholders.push(`$${paramIndex++}`);
          values.push(record[column] !== undefined ? record[column] : null);
        });
        valuePlaceholders.push(`(${recordPlaceholders.join(', ')})`);
      });
      
      const query = `
        INSERT INTO ${tableName} (${columnNames.join(', ')})
        VALUES ${valuePlaceholders.join(', ')}
        ON CONFLICT (id) DO UPDATE SET
        ${columnNames.filter(col => col !== 'id' && col !== 'created_at')
          .map(col => `${col} = EXCLUDED.${col}`).join(', ')}
      `;
      
      await client.query(query, values);
      await client.query('COMMIT');
      
      results.successful = records.length;
      
    } catch (error) {
      await client.query('ROLLBACK');
      results.failed = records.length;
      results.errors.push({ batch: true, error: error.message });
    } finally {
      client.release();
    }
    
    return results;
  }

  // Get table columns (cached)
  async getTableColumns(tableName) {
    const cacheKey = `columns_${tableName}`;
    if (this[cacheKey]) return this[cacheKey];
    
    const query = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `;
    
    const result = await this.pool.query(query, [tableName]);
    this[cacheKey] = result.rows;
    return result.rows;
  }

  // Performance monitoring
  async getPerformanceMetrics() {
    const metrics = {
      poolStats: {
        totalConnections: this.pool.totalCount,
        idleConnections: this.pool.idleCount,
        waitingClients: this.pool.waitingCount
      },
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    };
    
    return metrics;
  }

  async close() {
    await this.pool.end();
  }
}

// Export functions
module.exports = {
  OptimizedPostgreSQLImporter,
  PERFORMANCE_CONFIG
};