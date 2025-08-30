import React from 'react';

const SortDescIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h5.25m5.25 6.75l-4.5-4.5m0 0l-4.5 4.5m4.5-4.5v12" />
  </svg>
);

export default SortDescIcon;