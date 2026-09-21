Technology Platform

The CFA platform has minimum hardware and software requirements for client and server functioning, including compatible operating systems and integrated third-party services. An internet connection is the foundation of the system, since every page is rendered on demand from the server rather than run locally. The deployment diagram illustrates the nodes and the connections which make up the system. Client devices connect over the internet to a Next.js application hosted on Vercel, which in turn connects to a Supabase-hosted PostgreSQL database for authentication and data storage. The system will be able to function on any personal computer or mobile device with a modern web browser, without requiring any local installation.

Hardware

Client Side
The CFA platform is a web-based application, and therefore requires only a device with an internet connection and a modern web browser. The system is designed to run on a range of personal computers, tablets, and smartphones with differing CPU speeds and RAM sizes, and does not require any specialised hardware.

Server Side
The CFA platform is hosted on Vercel, which runs the Next.js application as on-demand functions rather than a dedicated server. The PostgreSQL database and authentication service are hosted separately on Supabase. Neither platform requires CFA to provision, size, or maintain any physical or virtual hardware, as both scale automatically with demand and are billed on usage rather than fixed capacity.

Software - Operating System

Client Side
Since the CFA platform is a web-based application, there are no limitations on client operating systems, as the system is accessed entirely through a web browser. No client-side software installation is required.

Server Side
The CFA platform is built using the Next.js framework with React and TypeScript, developed in Visual Studio Code. Supabase provides the PostgreSQL database along with built-in tools for managing migrations, authentication, and row-level security policies. Tailwind CSS and the shadcn/ui component library are used for styling. Peach Payments is the intended provider for handling membership and lesson payments, and Resend is the intended provider for transactional email, though neither integration has been built into the system yet.

Other
The CFA platform will run on a variety of web browsers, including Google Chrome, Microsoft Edge, Mozilla Firefox, and Safari.
