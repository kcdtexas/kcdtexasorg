// The sample Schedule: made-up Sessions and Speakers for test builds, in the raw shape a program platform hands
// over. src/lib/program.ts reads it only in a test build with --program-sample, next to the fixture
// (program-fixture.ts), and the pages label it "Sample". No real name reaches a preview.
//
// It copies the 2026 Schedule's shape (program-2026-schedule.ts), so the layout tests still bite: the same times,
// rooms, formats and breaks; three keynotes, a workshop by two Speakers and one by three; two Speakers with no
// tagline, two who share a surname, three-word names; three End-User Stories; and names, titles and taglines about as
// long as the real ones, the longest included. Every name, title, company and tagline is made up. src/lib/program.ts
// fails the build if a name here matches a real Speaker's, host's or Organizer's in src/data/, and
// tests/sample-program.mjs checks the built pages for the real ones.
import type { Break, RawSession, RawSpeaker } from '../lib/program';

const day = '2027-04-23';
const at = (t: string) => `${day}T${t}`;

export const sampleRooms: readonly string[] = ['Room 1', 'Room 2', 'Room 3'];

export const sampleSpeakers: readonly RawSpeaker[] = [
  { id: 'sm-1', name: 'Neva Calderwood', tagline: 'Pedernales OSF · TOC Member' },
  { id: 'sm-2', name: 'Thaddeus Wrenfield', tagline: 'Brazos Open Infrastructure Foundation (BOIF) · Executive Director' },
  { id: 'sm-3', name: 'Ines Marrowby', tagline: 'Open Source Security Circle Chair' },
  { id: 'sm-4', name: 'Hollis Quint', tagline: 'Spanlark Metrics · Community Ambassador, Senior Technical Advocate' },
  { id: 'sm-5', name: 'Ambrose Tullis', tagline: 'Gullwind Networks · Field CTO' },
  { id: 'sm-6', name: 'Benedikt Harrowgate', tagline: 'Certified Cluster Whisperer · Lead Architect · 14Y Infrastructure Engineer' },
  { id: 'sm-7', name: 'Bohdan Strelkiv', tagline: null },
  { id: 'sm-8', name: 'Tejaswini Kollur', tagline: 'Senior Engineering Manager at Pecos Ridge Bank(Tallyhorn)' },
  { id: 'sm-9', name: 'Mei Tanaru', tagline: 'Caprockly.io · Director of Open-Source' },
  { id: 'sm-10', name: 'Nikhil Deshwandi', tagline: 'Senior Platform Architect' },
  { id: 'sm-11', name: 'Varun Kodela', tagline: 'Nightheron.io · Staff Software Engineer' },
  { id: 'sm-12', name: 'Emre Kalkavan', tagline: 'Cactuswren IaC · Senior Solutions Architect' },
  { id: 'sm-13', name: 'Fergus O’Tierney', tagline: 'Cloud Native Architect, & Zero Trust Evangelist' },
  { id: 'sm-14', name: 'Teo De La Barrera', tagline: null },
  { id: 'sm-15', name: 'Minjae Quint', tagline: 'Bluebonnet Byteworks · Full Stack implementation & Integration Engineer' },
  { id: 'sm-16', name: 'Lucia Fennimore', tagline: 'Ashlarine · Research Scientist - Head of Ashlarine Research' },
  { id: 'sm-17', name: 'Arjun Malhavi', tagline: 'Dillo Freightworks · Staff Software Engineer' },
  { id: 'sm-18', name: 'Gideon Ashcombe', tagline: 'Hardscrabble Security · Founder & CEO' },
  { id: 'sm-19', name: 'Bruno Atencio', tagline: 'DevOps Engineer at Llano Byte Co. · 12+ years scaling cloud platforms' },
  { id: 'sm-20', name: 'Ottavio Bellandi', tagline: 'Fiorandi Labs · Kubernetes Release Docs Shadow, and DevRel Engineer' },
  { id: 'sm-21', name: 'Mateus Arraial', tagline: 'Big Thicket Cloud · Sr. Specialist Solutions Architect, Containers' },
  { id: 'sm-22', name: 'Ulises Barrientos Ocampo', tagline: 'Solution Architect at Big Thicket Cloud Services' },
  { id: 'sm-23', name: 'Wade Pettibone', tagline: 'Big Thicket Cloud · Specialist Solutions Architect' },
  { id: 'sm-24', name: 'Colby Ashendorf', tagline: 'Staff Software Engineer @ Mesquite Autonomy' },
  { id: 'sm-25', name: 'Rekha Vanjani', tagline: 'Policywright · DevOps Engineer' },
  { id: 'sm-26', name: 'Livia Brandt Salcedo', tagline: 'Traceburrow · Principal Developer Relations Engineer' },
  { id: 'sm-27', name: 'Saul Echeverri', tagline: 'TEJAVIA · CEO @Tejavia · OSPO - Community Ambassador, Guest Speaker, GLCN Co-Founder.' },
];

type Slot = [title: string, speakers: string[], start: string, end: string, room: string, format: RawSession['format'], endUser?: true];

const slots: Slot[] = [
  ['The Year in Cloud Native: Where Platforms Go Next', ['sm-1'], '09:15', '09:35', 'Room 1', 'keynote'],
  ['Shared Infrastructure for the Next Decade of Ops', ['sm-2'], '09:35', '09:55', 'Room 1', 'keynote'],
  ['Leave the Porch Light On', ['sm-3'], '09:55', '10:15', 'Room 1', 'keynote'],
  ['Talkin\' to the Cluster: Your Platform\'s Next Front Door Is a Chat Window', ['sm-4'], '10:30', '10:55', 'Room 1', 'talk'],
  ['Who changed that? And was it a supply chain Problem.', ['sm-5'], '10:30', '10:55', 'Room 2', 'talk'],
  ['The 90-Minute Golden Path: Bots Wrote My Runbook. Let\'s Build a Platform Together and Grade What\'s Left.', ['sm-6'], '10:30', '12:00', 'Room 3', 'workshop'],
  ['After the Hypervisor: Bringing Legacy VMs, GPUs, and Containers Under a Single Orchestrator', ['sm-7'], '11:10', '11:35', 'Room 1', 'talk'],
  ['On-Prem Meets Public Cloud at a Bank: Private Kubernetes for Audits and Control', ['sm-8'], '11:10', '11:35', 'Room 2', 'talk', true],
  ['Sharper Agents with Smaller, Well-Scoped Tools', ['sm-9'], '11:50', '12:15', 'Room 1', 'talk'],
  ['Model-Assisted Delivery: How LLMs and Agents Are Reshaping the Release Train', ['sm-10'], '11:50', '12:15', 'Room 2', 'talk'],
  ['Kubernetes-Powered Multi-Cloud Data Pipelines at Scale: The Nightheron Architecture', ['sm-11'], '13:15', '13:40', 'Room 1', 'talk'],
  ['Stop Idling GPUs: How We Built a Paved Road for Accelerator Sharing on Kubernetes', ['sm-12'], '13:15', '13:40', 'Room 2', 'talk'],
  ['Zero Trust Access for Internal Tools with Sidecars', ['sm-13', 'sm-14'], '13:15', '14:45', 'Room 3', 'workshop'],
  ['Model Serving and the Next Step for LLM Workloads: Inference Routing in Context', ['sm-15'], '13:55', '14:20', 'Room 1', 'talk'],
  ['Kernels for the Cloud Native Engineer', ['sm-16'], '13:55', '14:20', 'Room 2', 'talk'],
  ['We Moved to Spot Nodes and Our Bill Went Up: A Journey to Real Savings', ['sm-17'], '14:35', '15:00', 'Room 1', 'talk', true],
  ['Container Escapes: Rapid Unplanned Workload Disassembly', ['sm-18'], '14:35', '15:00', 'Room 2', 'talk'],
  ['Kubernetes on the Ranch: Declaring the Unpredictable at the Far Edge', ['sm-19'], '15:15', '15:40', 'Room 1', 'talk'],
  ['Right-Sizing Pods for Slow Application Startup', ['sm-20'], '15:15', '15:40', 'Room 2', 'talk'],
  ['From Laptop to Cluster: Serving Production-Ready LLMs on Kubernetes with Shared GPUs - Workshop', ['sm-21', 'sm-22', 'sm-23'], '15:15', '16:45', 'Room 3', 'workshop'],
  ['Reboots, Reboot(ed): Self Service, Multi-Tenant Infrastructure With Rolling Node Restarts', ['sm-24'], '15:55', '16:20', 'Room 1', 'talk', true],
  ['Cracking the Top 10 Risks for Kubernetes', ['sm-25'], '15:55', '16:20', 'Room 2', 'talk'],
  ['Mastering the Dark Arts of Trace Debugging', ['sm-26'], '16:35', '17:00', 'Room 1', 'talk'],
  ['PLAYBOOK.md and Beyond: Open Conventions for AI-Assisted Engineering', ['sm-27'], '16:35', '17:00', 'Room 2', 'talk'],
];

export const sampleSessions: readonly RawSession[] = slots.map(([title, speakers, start, end, room, format, endUser], i) => (
  { id: `sm-s${i + 1}`, title, format, endUser: endUser ?? false, speakers, start: at(start), end: at(end), room }
));

/** Plenary items with no Speaker, as on the 2026 Schedule. */
export const sampleBreaks: readonly Break[] = [
  { title: 'Registration', start: at('08:05'), end: at('08:55'), room: null },
  { title: 'Sponsor Callout (Platinum/Gold)', start: at('08:55'), end: at('09:15'), room: null },
  { title: 'Lunch', start: at('12:15'), end: at('13:15'), room: null },
  { title: 'Sponsor Callout (Silver)', start: at('17:15'), end: at('17:30'), room: 'Room 1' },
  { title: 'Closing Ceremony', start: at('17:30'), end: at('18:00'), room: null },
];
