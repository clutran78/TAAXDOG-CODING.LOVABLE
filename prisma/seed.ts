import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create demo user
  const hashedPassword = await bcrypt.hash('demo123', 12)
  
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@taxreturnpro.com.au' },
    update: {},
    create: {
      email: 'demo@taxreturnpro.com.au',
      name: 'Demo User',
      password: hashedPassword,
      emailVerified: new Date(),
      isActive: true
    }
  })

  console.log('👤 Created demo user:', demoUser.email)

  // Create demo bank account
  const demoBankAccount = await prisma.bankAccount.upsert({
    where: { 
      userId_accountNumber: {
        userId: demoUser.id,
        accountNumber: '123456789'
      }
    },
    update: {},
    create: {
      userId: demoUser.id,
      institutionName: 'Commonwealth Bank',
      accountName: 'Everyday Account',
      accountNumber: '123456789',
      bsb: '062-001',
      accountType: 'SAVINGS',
      balance: 5000.00,
      isActive: true,
      connectionStatus: 'connected',
      lastSynced: new Date()
    }
  })

  console.log('🏦 Created demo bank account')

  // Create demo transactions
  const transactions = [
    {
      userId: demoUser.id,
      bankAccountId: demoBankAccount.id,
      type: 'INCOME',
      amount: 3500.00,
      description: 'Salary Payment',
      category: 'Salary',
      date: new Date('2024-01-15'),
      merchant: 'ABC Company Pty Ltd'
    },
    {
      userId: demoUser.id,
      bankAccountId: demoBankAccount.id,
      type: 'EXPENSE',
      amount: 1200.00,
      description: 'Rent Payment',
      category: 'Housing',
      date: new Date('2024-01-01'),
      merchant: 'Property Manager'
    },
    {
      userId: demoUser.id,
      bankAccountId: demoBankAccount.id,
      type: 'EXPENSE',
      amount: 85.50,
      description: 'Grocery Shopping',
      category: 'Food & Dining',
      date: new Date('2024-01-10'),
      merchant: 'Woolworths'
    },
    {
      userId: demoUser.id,
      bankAccountId: demoBankAccount.id,
      type: 'EXPENSE',
      amount: 45.00,
      description: 'Fuel',
      category: 'Transportation',
      date: new Date('2024-01-12'),
      merchant: 'Shell'
    }
  ]

  for (const transaction of transactions) {
    await prisma.transaction.create({
      data: transaction
    })
  }

  console.log('💳 Created demo transactions')

  // Create demo goals
  const goals = [
    {
      userId: demoUser.id,
      name: 'Emergency Fund',
      description: 'Build an emergency fund for unexpected expenses',
      targetAmount: 10000.00,
      currentAmount: 2500.00,
      targetDate: new Date('2024-12-31'),
      category: 'Emergency Fund',
      isCompleted: false
    },
    {
      userId: demoUser.id,
      name: 'Holiday Savings',
      description: 'Save for a trip to Europe',
      targetAmount: 5000.00,
      currentAmount: 1200.00,
      targetDate: new Date('2024-06-30'),
      category: 'Travel',
      isCompleted: false
    }
  ]

  for (const goal of goals) {
    await prisma.goal.create({
      data: goal
    })
  }

  console.log('🎯 Created demo goals')

  // Create demo tax profile
  await prisma.taxProfile.upsert({
    where: { userId: demoUser.id },
    update: {},
    create: {
      userId: demoUser.id,
      tfn: '123456789',
      abn: '12345678901',
      businessName: 'Demo Business',
      isGstRegistered: true,
      gstRegistrationDate: new Date('2023-01-01'),
      taxResidencyStatus: 'resident',
      financialYearEnd: '30-06',
      accountingMethod: 'cash',
      businessStructure: 'sole_trader',
      businessAddress: {
        street: '123 Business Street',
        suburb: 'Sydney',
        state: 'NSW',
        postcode: '2000'
      }
    }
  })

  console.log('📋 Created demo tax profile')

  // Create demo user settings
  await prisma.userSettings.upsert({
    where: { userId: demoUser.id },
    update: {},
    create: {
      userId: demoUser.id,
      settings: {
        notifications: {
          email: true,
          push: true,
          weeklyReports: true,
          goalReminders: true,
          transactionAlerts: true
        },
        privacy: {
          dataSharing: false,
          analyticsTracking: true,
          marketingEmails: false
        },
        preferences: {
          currency: 'AUD',
          dateFormat: 'DD/MM/YYYY',
          timeZone: 'Australia/Sydney',
          language: 'en-AU'
        },
        security: {
          twoFactorEnabled: false,
          sessionTimeout: 30
        }
      }
    }
  })

  console.log('⚙️ Created demo user settings')

  console.log('✅ Database seeding completed!')
  console.log('')
  console.log('Demo account credentials:')
  console.log('Email: demo@taxreturnpro.com.au')
  console.log('Password: demo123')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })