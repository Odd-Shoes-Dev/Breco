import { NextRequest, NextResponse } from 'next/server';

interface ScheduledReport {
  id: string;
  reportType: string;
  reportName: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  monthOfQuarter?: number;
  time: string;
  recipients: string[];
  format: 'pdf' | 'excel' | 'csv';
  parameters: {
    startDate?: string;
    endDate?: string;
    customerType?: string;
    sortBy?: string;
  };
  isActive: boolean;
  createdAt: string;
  lastRun?: string;
  nextRun: string;
  runCount: number;
}

// Mock database - In a real app, this would be in your database
let scheduledReports: ScheduledReport[] = [
  {
    id: 'sched_001',
    reportType: 'profit-loss',
    reportName: 'Monthly P&L Statement',
    frequency: 'monthly',
    dayOfMonth: 1,
    time: '09:00',
    recipients: ['admin@brecosafaris.com', 'accounting@brecosafaris.com'],
    format: 'pdf',
    parameters: {},
    isActive: true,
    createdAt: '2024-11-01T09:00:00Z',
    lastRun: '2024-12-01T09:00:00Z',
    nextRun: '2025-01-01T09:00:00Z',
    runCount: 2,
  },
  {
    id: 'sched_002',
    reportType: 'sales-by-customer',
    reportName: 'Weekly Sales Analysis',
    frequency: 'weekly',
    dayOfWeek: 1, // Monday
    time: '08:30',
    recipients: ['sales@brecosafaris.com'],
    format: 'excel',
    parameters: {
      sortBy: 'totalSales',
      customerType: 'all',
    },
    isActive: true,
    createdAt: '2024-11-15T08:30:00Z',
    lastRun: '2024-12-09T08:30:00Z',
    nextRun: '2024-12-16T08:30:00Z',
    runCount: 5,
  },
  {
    id: 'sched_003',
    reportType: 'tax-summary',
    reportName: 'Quarterly Tax Summary',
    frequency: 'quarterly',
    monthOfQuarter: 1,
    time: '10:00',
    recipients: ['tax@brecosafaris.com', 'admin@brecosafaris.com'],
    format: 'pdf',
    parameters: {},
    isActive: false,
    createdAt: '2024-10-01T10:00:00Z',
    nextRun: '2025-04-01T10:00:00Z',
    runCount: 1,
  },
];

function generateNextRun(schedule: Omit<ScheduledReport, 'id' | 'createdAt' | 'lastRun' | 'nextRun' | 'runCount'>): string {
  const now = new Date();
  const [hours, minutes] = schedule.time.split(':').map(Number);
  
  let nextRun: Date;

  switch (schedule.frequency) {
    case 'daily':
      nextRun = new Date(now);
      nextRun.setHours(hours, minutes, 0, 0);
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;

    case 'weekly':
      nextRun = new Date(now);
      nextRun.setHours(hours, minutes, 0, 0);
      const currentDay = nextRun.getDay();
      const targetDay = schedule.dayOfWeek || 0;
      const daysUntilTarget = (targetDay - currentDay + 7) % 7;
      
      if (daysUntilTarget === 0 && nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 7);
      } else {
        nextRun.setDate(nextRun.getDate() + daysUntilTarget);
      }
      break;

    case 'monthly':
      nextRun = new Date(now);
      nextRun.setDate(schedule.dayOfMonth || 1);
      nextRun.setHours(hours, minutes, 0, 0);
      
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
      break;

    case 'quarterly':
      nextRun = new Date(now);
      const currentQuarter = Math.floor(nextRun.getMonth() / 3);
      const nextQuarterStart = new Date(nextRun.getFullYear(), (currentQuarter + 1) * 3, 1);
      nextRun = nextQuarterStart;
      nextRun.setHours(hours, minutes, 0, 0);
      break;

    default:
      nextRun = new Date(now);
      nextRun.setDate(nextRun.getDate() + 1);
      nextRun.setHours(hours, minutes, 0, 0);
  }

  return nextRun.toISOString();
}

export async function GET() {
  try {
    return NextResponse.json(scheduledReports);
  } catch (error) {
    console.error('Failed to fetch scheduled reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scheduled reports' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    const newSchedule: ScheduledReport = {
      id: `sched_${Date.now()}`,
      ...data,
      createdAt: new Date().toISOString(),
      nextRun: generateNextRun(data),
      runCount: 0,
    };

    scheduledReports.push(newSchedule);

    return NextResponse.json(newSchedule, { status: 201 });
  } catch (error) {
    console.error('Failed to create scheduled report:', error);
    return NextResponse.json(
      { error: 'Failed to create scheduled report' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const data = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      );
    }

    const scheduleIndex = scheduledReports.findIndex(s => s.id === id);
    if (scheduleIndex === -1) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    const updatedSchedule = {
      ...scheduledReports[scheduleIndex],
      ...data,
    };

    // Recalculate next run if schedule parameters changed
    if (data.frequency || data.time || data.dayOfWeek || data.dayOfMonth) {
      updatedSchedule.nextRun = generateNextRun(updatedSchedule);
    }

    scheduledReports[scheduleIndex] = updatedSchedule;

    return NextResponse.json(updatedSchedule);
  } catch (error) {
    console.error('Failed to update scheduled report:', error);
    return NextResponse.json(
      { error: 'Failed to update scheduled report' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      );
    }

    const scheduleIndex = scheduledReports.findIndex(s => s.id === id);
    if (scheduleIndex === -1) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    scheduledReports.splice(scheduleIndex, 1);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete scheduled report:', error);
    return NextResponse.json(
      { error: 'Failed to delete scheduled report' },
      { status: 500 }
    );
  }
}