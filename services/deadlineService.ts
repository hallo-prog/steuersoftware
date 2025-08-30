import { Deadline } from '../types';

const getDaysDifference = (date1: Date, date2: Date): number => {
    const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
    const diffTime = date2.getTime() - date1.getTime();
    return Math.round(diffTime / oneDay);
};

export const getDeadlines = (): Deadline[] => {
    const deadlines: Deadline[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today's date

    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-11
    const currentQuarter = Math.floor(currentMonth / 3) + 1;

    // 1. VAT Pre-declarations (Umsatzsteuervoranmeldung)
    // Due on the 10th of the month following the quarter's end.
    // We want to show upcoming deadlines for the next few quarters.
    for (let i = 0; i < 4; i++) {
        const yearOffset = Math.floor((currentQuarter + i - 1) / 4);
        const targetYear = currentYear + yearOffset;
        const targetQuarter = ((currentQuarter + i - 1) % 4) + 1;

        const endOfMonth = (targetQuarter * 3) - 1; // Q1 -> M 2, Q2 -> M 5, etc.
        const dueDate = new Date(targetYear, endOfMonth + 1, 10); // 10th of the next month
        
        if (dueDate >= today) {
            deadlines.push({
                id: `ustva-${targetYear}-q${targetQuarter}`,
                title: `Umsatzsteuervoranmeldung Q${targetQuarter} ${targetYear}`,
                dueDate,
                remainingDays: getDaysDifference(today, dueDate)
            });
        }
    }

    // 2. Income Tax Declaration (Einkommensteuererklärung)
    // For the previous year, due at the end of the current year.
    const lastYear = currentYear - 1;
    const incomeTaxDueDate = new Date(currentYear, 11, 31); // Dec 31 of current year

    if (incomeTaxDueDate >= today) {
        deadlines.push({
            id: `est-${lastYear}`,
            title: `Einkommensteuererklärung ${lastYear}`,
            dueDate: incomeTaxDueDate,
            remainingDays: getDaysDifference(today, incomeTaxDueDate)
        });
    }

    // Sort deadlines by due date
    return deadlines.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
};