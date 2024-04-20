export const Messages = {
  now: 'Now',
  schedule: 'Schedule',
  deleteModal: {
    header: 'Delete schedule',
    content: (scheduleName: string) =>
      `Are you sure you want to permanently delete schedule "${scheduleName}"?`,
  },
  maximumPgSchedules: 'Note: Maximum 3 schedules for PostgreSQL',
  activeSchedules: (schedulesNumber: number) =>
    `${schedulesNumber} active schedule${schedulesNumber > 1 ? 's' : ''}`,
  exceededScheduleBackupsNumber:
    'You have exceeded the limit of schedules allowed for PostgreSQL.',
};
