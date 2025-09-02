import React from 'react';

const DebtIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M4 6h16" />
    <path d="M4 10h16" />
    <path d="M4 14h10" />
    <path d="M4 18h6" />
    <circle cx="18" cy="17" r="3" />
    <path d="M18 15v4" />
    <path d="M16.5 16.5h3" />
  </svg>
);

export default DebtIcon;
