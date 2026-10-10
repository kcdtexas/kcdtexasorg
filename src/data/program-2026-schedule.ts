// The 2026 Schedule as test data: from the public KCD Texas 2026 Schedule (May 15, 2026), only the Session
// titles, the Speaker names, the times (Central), the rooms and the formats. No bios, photos or abstracts.
// Affiliations come from program-2026.ts's printed lines, matched by name, in src/lib/program.ts.

export type Format2026 = 'keynote' | 'talk' | 'workshop' | 'panel';

export interface ScheduleSession2026 {
  title: string;
  speakers: readonly string[]; // names exactly as Sessionize prints them
  /** Central local time, 'YYYY-MM-DDTHH:MM'. */
  start: string;
  end: string;
  room: string;
  format: Format2026;
}

/** Plenary items with no Speaker (registration, breaks, lunch, closing), for the Schedule's rhythm. */
export interface ScheduleBreak2026 { title: string; start: string; end: string; room: string | null; }

export const sessions2026: readonly ScheduleSession2026[] = [
  { title: 'The State of Cloud Native: The Shift Towards AI', speakers: ['Katie Gamanji'], start: '2026-05-15T09:15', end: '2026-05-15T09:35', room: 'Room 1', format: 'keynote' },
  { title: 'Open Source Infrastructure for the AI Native Era', speakers: ['Jonathan Bryce'], start: '2026-05-15T09:35', end: '2026-05-15T09:55', room: 'Room 1', format: 'keynote' },
  { title: 'Look for the Helpers', speakers: ['Ian Coldwater'], start: '2026-05-15T09:55', end: '2026-05-15T10:15', room: 'Room 1', format: 'keynote' },
  { title: 'Livin\' In the Future: Your Platform\'s Next Interface Is an AI Agent', speakers: ['Whitney Lee'], start: '2026-05-15T10:30', end: '2026-05-15T10:55', room: 'Room 1', format: 'talk' },
  { title: 'How did that happen? And is it a security Problem.', speakers: ['Duffie Cooley'], start: '2026-05-15T10:30', end: '2026-05-15T10:55', room: 'Room 2', format: 'talk' },
  { title: 'The 90-Minute IDP: AI Ate My Implementation. Let\'s Build a Platform Together and Score What\'s Left.', speakers: ['Michael Forrester'], start: '2026-05-15T10:30', end: '2026-05-15T12:00', room: 'Room 3', format: 'workshop' },
  { title: 'The Post-Hypervisor Era: Unifying Brownfield VMs, AI, and Containers on a Single Control Plane', speakers: ['Myroslav Mishov'], start: '2026-05-15T11:10', end: '2026-05-15T11:35', room: 'Room 1', format: 'talk' },
  { title: 'Hybrid Cloud at Enterprise Scale: Private Kubernetes for Portability and Control', speakers: ['Shravani Gunturu'], start: '2026-05-15T11:10', end: '2026-05-15T11:35', room: 'Room 2', format: 'talk' },
  { title: 'Enhance Your Agent Accuracy with Agent Skills', speakers: ['Lin Sun'], start: '2026-05-15T11:50', end: '2026-05-15T12:15', room: 'Room 1', format: 'talk' },
  { title: 'AI-Driven DevOps: How LLMs and Agents Are Changing Software Delivery', speakers: ['Kedar Kulkarni'], start: '2026-05-15T11:50', end: '2026-05-15T12:15', room: 'Room 2', format: 'talk' },
  { title: 'Kubernetes-Powered Multi-Cloud Apache Airflow at Scale: The Astro Architecture', speakers: ['Goutam Tadi'], start: '2026-05-15T13:15', end: '2026-05-15T13:40', room: 'Room 1', format: 'talk' },
  { title: 'Stop Wasting GPUs: How We Built a Golden Path for GPU Sharing on Kubernetes', speakers: ['Engin Diri'], start: '2026-05-15T13:15', end: '2026-05-15T13:40', room: 'Room 2', format: 'talk' },
  { title: 'Identity-Aware Access Control with Reverse Proxies', speakers: ['Peter ONeill', 'Chris De La Garza'], start: '2026-05-15T13:15', end: '2026-05-15T14:45', room: 'Room 3', format: 'workshop' },
  { title: 'KServe and the Next Step for LLM Workloads: LLMInferenceService in Context', speakers: ['Jooho lee'], start: '2026-05-15T13:55', end: '2026-05-15T14:20', room: 'Room 1', format: 'talk' },
  { title: 'Linux for the Cloud Native Engineer', speakers: ['Marina Moore'], start: '2026-05-15T13:55', end: '2026-05-15T14:20', room: 'Room 2', format: 'talk' },
  { title: 'We Migrated to Karpenter and Our Costs Went Up: A Journey to Real Savings', speakers: ['Abhinav Dahiya'], start: '2026-05-15T14:35', end: '2026-05-15T15:00', room: 'Room 1', format: 'talk' },
  { title: 'Sandbox Breakouts: Rapid Unscheduled Agentic Assembly', speakers: ['Andrew Martin'], start: '2026-05-15T14:35', end: '2026-05-15T15:00', room: 'Room 2', format: 'talk' },
  { title: 'Kubernetes at the Edge: Declaring the Indeterminable with Nix and K3s', speakers: ['Cesar Diaz'], start: '2026-05-15T15:15', end: '2026-05-15T15:40', room: 'Room 1', format: 'talk' },
  { title: 'Stop Overprovisioning for Application Startup', speakers: ['Graziano Casto'], start: '2026-05-15T15:15', end: '2026-05-15T15:40', room: 'Room 2', format: 'talk' },
  { title: 'From Zero to Hero: Deploying Production-Ready LLMs on Kubernetes with NVIDIA GPUs - Workshop', speakers: ['Lucas Duarte', 'Jairo Martinez Mantilla', 'Eric Anderson'], start: '2026-05-15T15:15', end: '2026-05-15T16:45', room: 'Room 3', format: 'workshop' },
  { title: 'We have the Kure(d): Self Service, Multi-Tenant Infrastructure With Kured and Flatcar Linux', speakers: ['Tyler Auerbeck'], start: '2026-05-15T15:55', end: '2026-05-15T16:20', room: 'Room 1', format: 'talk' },
  { title: 'Cracking the OWASP 10 for Kubernetes', speakers: ['Dolis Sharma'], start: '2026-05-15T15:55', end: '2026-05-15T16:20', room: 'Room 2', format: 'talk' },
  { title: 'Mastering the Dark Arts of OTel Debugging', speakers: ['Julia Furst Morgado'], start: '2026-05-15T16:35', end: '2026-05-15T17:00', room: 'Room 1', format: 'talk' },
  { title: 'AGENTS.md and Beyond: Open Standards for AI-Assisted Engineering', speakers: ['Angel Ramirez'], start: '2026-05-15T16:35', end: '2026-05-15T17:00', room: 'Room 2', format: 'talk' },
];

export const breaks2026: readonly ScheduleBreak2026[] = [
  { title: 'Registration', start: '2026-05-15T08:05', end: '2026-05-15T08:55', room: null },
  { title: 'Sponsor Callout (Platinum/Gold)', start: '2026-05-15T08:55', end: '2026-05-15T09:15', room: null },
  { title: 'Lunch', start: '2026-05-15T12:15', end: '2026-05-15T13:15', room: null },
  { title: 'Sponsor Callout (Silver)', start: '2026-05-15T17:15', end: '2026-05-15T17:30', room: 'Room 1' },
  { title: 'Closing Ceremony', start: '2026-05-15T17:30', end: '2026-05-15T18:00', room: null },
];

export const rooms2026: readonly string[] = ['Room 1', 'Room 2', 'Room 3'];
