import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    const userSettings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!userSettings) {
      // Return default settings if none exist
      return NextResponse.json({
        notifications: {
          email: true,
          push: true,
          weeklyReports: true,
          goalReminders: true,
          transactionAlerts: true,
        },
        privacy: {
          dataSharing: false,
          analyticsTracking: true,
          marketingEmails: false,
        },
        preferences: {
          currency: 'AUD',
          dateFormat: 'DD/MM/YYYY',
          timeZone: 'Australia/Sydney',
          language: 'en-AU',
        },
        security: {
          twoFactorEnabled: false,
          sessionTimeout: 30,
        },
      });
    }

    return NextResponse.json(userSettings.settings);
  } catch (error) {
    console.error('User settings GET API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();

    const { notifications, privacy, preferences, security } = body;

    // Validate settings structure
    if (!notifications || !privacy || !preferences || !security) {
      return NextResponse.json({ error: 'Invalid settings structure' }, { status: 400 });
    }

    const settingsData = {
      notifications,
      privacy,
      preferences,
      security,
    };

    const updatedSettings = await prisma.userSettings.upsert({
      where: { userId },
      update: {
        settings: settingsData,
        updatedAt: new Date(),
      },
      create: {
        userId,
        settings: settingsData,
      },
    });

    return NextResponse.json(updatedSettings.settings);
  } catch (error) {
    console.error('User settings PUT API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
