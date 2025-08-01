import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    const taxProfile = await prisma.taxProfile.findUnique({
      where: { userId }
    })

    if (!taxProfile) {
      return NextResponse.json(
        { error: 'Tax profile not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: taxProfile.id,
      tfn: taxProfile.tfn,
      abn: taxProfile.abn,
      businessName: taxProfile.businessName,
      isGstRegistered: taxProfile.isGstRegistered,
      gstRegistrationDate: taxProfile.gstRegistrationDate?.toISOString().split('T')[0],
      taxResidencyStatus: taxProfile.taxResidencyStatus,
      financialYearEnd: taxProfile.financialYearEnd,
      accountingMethod: taxProfile.accountingMethod,
      businessStructure: taxProfile.businessStructure,
      industryCode: taxProfile.industryCode,
      businessAddress: taxProfile.businessAddress
    })

  } catch (error) {
    console.error('Tax profile GET API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const body = await request.json()

    const {
      tfn,
      abn,
      businessName,
      isGstRegistered,
      gstRegistrationDate,
      taxResidencyStatus,
      financialYearEnd,
      accountingMethod,
      businessStructure,
      industryCode,
      businessAddress
    } = body

    // Validate required fields
    if (!taxResidencyStatus || !financialYearEnd) {
      return NextResponse.json(
        { error: 'Tax residency status and financial year end are required' },
        { status: 400 }
      )
    }

    // Validate TFN format if provided
    if (tfn && !/^\d{8,9}$/.test(tfn.replace(/\s/g, ''))) {
      return NextResponse.json(
        { error: 'Invalid TFN format' },
        { status: 400 }
      )
    }

    // Validate ABN format if provided
    if (abn && !/^\d{11}$/.test(abn.replace(/\s/g, ''))) {
      return NextResponse.json(
        { error: 'Invalid ABN format' },
        { status: 400 }
      )
    }

    // Business name required if ABN provided
    if (abn && !businessName?.trim()) {
      return NextResponse.json(
        { error: 'Business name is required when ABN is provided' },
        { status: 400 }
      )
    }

    const taxProfileData = {
      userId,
      tfn: tfn || null,
      abn: abn || null,
      businessName: businessName || null,
      isGstRegistered: isGstRegistered || false,
      gstRegistrationDate: gstRegistrationDate ? new Date(gstRegistrationDate) : null,
      taxResidencyStatus,
      financialYearEnd,
      accountingMethod: accountingMethod || 'cash',
      businessStructure: businessStructure || 'sole_trader',
      industryCode: industryCode || null,
      businessAddress: businessAddress || {}
    }

    const updatedProfile = await prisma.taxProfile.upsert({
      where: { userId },
      update: taxProfileData,
      create: taxProfileData
    })

    return NextResponse.json({
      id: updatedProfile.id,
      tfn: updatedProfile.tfn,
      abn: updatedProfile.abn,
      businessName: updatedProfile.businessName,
      isGstRegistered: updatedProfile.isGstRegistered,
      gstRegistrationDate: updatedProfile.gstRegistrationDate?.toISOString().split('T')[0],
      taxResidencyStatus: updatedProfile.taxResidencyStatus,
      financialYearEnd: updatedProfile.financialYearEnd,
      accountingMethod: updatedProfile.accountingMethod,
      businessStructure: updatedProfile.businessStructure,
      industryCode: updatedProfile.industryCode,
      businessAddress: updatedProfile.businessAddress
    })

  } catch (error) {
    console.error('Tax profile PUT API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}