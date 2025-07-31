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
      emailVerified: new Date()
    }
  })

  console.log('👤 Created demo user:', demoUser.email)

  // Create demo goal
  const goal = await prisma.goal.create({
    data: {
      userId: demoUser.id,
      title: 'Emergency Fund',
      targetAmount: 10000.00,
      currentAmount: 2500.00,
      targetDate: new Date('2024-12-31'),
      category: 'Emergency Fund'
    }
  })

  console.log('🎯 Created demo goal:', goal.title)

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