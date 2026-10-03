// The 2026 program as public data: names and affiliations exactly as printed on the 2026 Event Page
// (May 2026, so they may be out of date), talk titles and video IDs from the 2026 YouTube playlist.
// Only these fields: no bios, no abstracts, no photos. A talk without a published recording has no
// title in this snapshot, so it shows the Speaker only.

export interface ProgramEntry {
  name: string;
  /** The affiliation lines as printed on the Event Page card; empty when the card printed none. */
  printed: readonly string[];
  title: string | null;
  youtube: string | null;
}

export const keynotes2026: readonly ProgramEntry[] = [
  { name: 'Katie Gamanji', printed: ['CNCF', 'TOC Member'], title: 'The State of Cloud Native: The Shift Towards AI', youtube: 'Z2hOG3K0gis' },
  { name: 'Jonathan Bryce', printed: ['Cloud Native Computing Foundation (CNCF)', 'Executive Director'], title: 'Open Source Infrastructure for the AI Native Era', youtube: 'bTjnWq2zCkw' },
  { name: 'Ian Coldwater', printed: ['Kubernetes SIG Security Chair'], title: null, youtube: null },
];

// Every other Speaker, by surname.
export const speakers2026: readonly ProgramEntry[] = [
  { name: 'Eric Anderson', printed: ['AWS', 'Specialist Solutions Architect'], title: null, youtube: null },
  { name: 'Tyler Auerbeck', printed: ['Staff Software Engineer @ Stack AV'], title: 'Self-Service, Multi-Tenant Infrastructure With Kured and Flatcar Linux', youtube: 'WoI83_KQtWM' },
  { name: 'Graziano Casto', printed: ['Akamas', 'Kubernetes v1.35 Comms Lead, and DevRel Engineer'], title: 'Stop Over-provisioning for Application Startup', youtube: 'WPny5KlmaBU' },
  { name: 'Duffie Cooley', printed: ['Isovalent', 'Field CTO'], title: 'How did that happen? And is it a security Problem', youtube: 'TTF_RBrRrA8' },
  { name: 'Abhinav Dahiya', printed: ['Lyft', 'Staff Software Engineer'], title: 'We Migrated to Karpenter and Our Costs Went Up: A Journey to Real Savings', youtube: 'UdpviRNrnj8' },
  { name: 'Chris De La Garza', printed: [], title: null, youtube: null },
  { name: 'Cesar Diaz', printed: ['DevOps Engineer at Globant · 10+ years scaling cloud platforms'], title: 'Kubernetes at the Edge: Declaring the Indeterminable with Nix and K3s', youtube: 'w-H7a4UFHvU' },
  { name: 'Engin Diri', printed: ['Pulumi', 'Senior Solutions Architect'], title: 'Stop Wasting GPUs: How We Built a Golden Path for GPU Sharing on Kubernetes', youtube: 'JA1wtMhhQCE' },
  { name: 'Lucas Duarte', printed: ['AWS', 'Sr. Specialist Solutions Architect, Containers'], title: null, youtube: null },
  { name: 'Michael Forrester', printed: ['Kubestronaut', 'Lead Architect', '16Y Infrastructure Engineer'], title: null, youtube: null },
  { name: 'Julia Furst Morgado', printed: ['Dash0', 'Principal Developer Relations Engineer'], title: 'Mastering the Dark Arts of OTel Debugging', youtube: 'nUqS3YcmloI' },
  { name: 'Shravani Gunturu', printed: ['Senior Engineering Manager at Sofi(Galileo)'], title: 'Hybrid Cloud at Enterprise Scale: Private Kubernetes for Portability and Control', youtube: 'RQUGlPV0DOg' },
  { name: 'Kedar Kulkarni', printed: ['Senior DevOps Architect'], title: null, youtube: null },
  { name: 'Jooho Lee', printed: ['Red Hat', 'Full Stack implementation & Integration Engineer'], title: null, youtube: null },
  { name: 'Whitney Lee', printed: ['Datadog', 'CNCF Ambassador, Senior Technical Advocate'], title: 'Livin’ In the Future: Your Platform’s Next Interface Is an AI Agent', youtube: 'dtVy1lD6KiQ' },
  { name: 'Andrew Martin', printed: ['Controlplane', 'Founder & CEO'], title: 'Sandbox Breakouts: Rapid Unscheduled Agentic Assembly', youtube: 'mxU9pci8v5E' },
  { name: 'Jairo Martinez Mantilla', printed: ['Solution Architect at Amazon Web Services'], title: null, youtube: null },
  { name: 'Myroslav Mishov', printed: [], title: 'Unifying Brownfield VMs, AI, and Containers on a Single Control Plane', youtube: 'NoXKoo2Khkw' },
  { name: 'Marina Moore', printed: ['Edera', 'Research Scientist - Head of Edera Research'], title: 'Linux for the Cloud Native Engineer', youtube: 'gOQxiU5NGOk' },
  { name: 'Peter O’Neill', printed: ['Cloud Native Architect, & Security Evangelist'], title: null, youtube: null },
  { name: 'Angel Ramirez', printed: ['CUEMBY', 'CEO @Cuemby', 'OSPO - CNCF Ambassador, Guest Speaker, FHCN Co-Founder.'], title: 'AGENTS.md and Beyond: Open Standards for AI-Assisted Engineering', youtube: 'pguW2_djQQA' },
  { name: 'Dolis Sharma', printed: ['Nirmata', 'DevOps Engineer'], title: 'Cracking the OWASP 10 for Kubernetes', youtube: 'SGFaUEkPUrY' },
  { name: 'Lin Sun', printed: ['Solo.io', 'Director of Open-Source'], title: 'Enhance Your Agent Accuracy with Agent Skills', youtube: 'A4lzfGS-110' },
  { name: 'Goutam Tadi', printed: ['Astronomer.io', 'Staff Software Engineer'], title: 'Kubernetes-Powered Multi-Cloud Apache Airflow at Scale: The Astro Architecture', youtube: 'SRs_EkYHMUE' },
];

export const hosts2026: readonly ProgramEntry[] = [
  { name: 'Lisa-Marie Namphy', printed: ['CNCF Ambassador, DevRel Architect'], title: null, youtube: null },
  { name: 'Hanna Busekrus', printed: ['Austin Women in Technology (AWT)', 'VP of Partnerships'], title: null, youtube: null },
  { name: 'Nicole Pletka', printed: ['Austin Women in Technology (AWT)', 'VP'], title: null, youtube: null },
];

/** The printed lines on one line. */
export const asPrinted = (e: ProgramEntry) => e.printed.join(' · ');
