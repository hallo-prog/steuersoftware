
import React from 'react';

const FolderIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6.226c0-1.232.996-2.226 2.226-2.226h4.126c.51 0 1.003.2 1.358.56l.82 1.103a.75.75 0 00.678.337h3.386c1.23 0 2.226.994 2.226 2.226v1.551" />
  </svg>
);

export default FolderIcon;
