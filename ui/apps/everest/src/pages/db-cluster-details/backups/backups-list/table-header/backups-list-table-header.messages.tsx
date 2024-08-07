export const Messages = {
  now: 'Now',
  schedule: 'Schedule',
  deleteModal: {
    header: 'Delete schedule',
    content: (scheduleName: string) => (
      <>
        Are you sure you want to permanently delete schedule{' '}
        <b>{scheduleName}</b>?
      </>
    ),
  },
  activeSchedules: (schedulesNumber: number) =>
    `${schedulesNumber} active schedule${schedulesNumber > 1 ? 's' : ''}`,
};
