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
  { id: 'sm-1', name: 'Neva Calderwood', tagline: 'Program Lead, Prairie Compute Collective' },
  { id: 'sm-2', name: 'Thaddeus Wrenfield', tagline: 'Spanlark Metrics · VP of Engineering, Runtime and Developer Platforms' },
  { id: 'sm-3', name: 'Ines Marrowby', tagline: 'Hill Country Systems · Principal Engineer' },
  { id: 'sm-4', name: 'Hollis Ferrante', tagline: 'Gullwind Networks · Senior Developer Advocate, Platform Tooling' },
  { id: 'sm-5', name: 'Ambrose Tullis', tagline: 'Caprockly · Staff Engineer' },
  { id: 'sm-6', name: 'Benedikt Harrowgate', tagline: 'Mesquite Freight Systems · Lead Platform Architect · Weekend Woodworker' },
  { id: 'sm-7', name: 'Bohdan Strelkiv', tagline: null },
  { id: 'sm-8', name: 'Tejaswini Kollur', tagline: 'Engineering Manager, Dispatch Platform at Dillo Freightworks' },
  { id: 'sm-9', name: 'Mei Quint', tagline: 'Tallyhorn · Head of Open Source Programs' },
  { id: 'sm-10', name: 'Nikhil Deshwandi', tagline: 'Principal Infrastructure Engineer' },
  { id: 'sm-11', name: 'Varun Kodela', tagline: 'Nightheron · Senior Data Platform Engineer' },
  { id: 'sm-12', name: 'Emre Kalkavan', tagline: 'Cactuswren · Cloud Infrastructure Lead' },
  { id: 'sm-13', name: 'Fergus Lindqvist', tagline: 'Bluebonnet Byteworks · Security Engineer and Workshop Host' },
  { id: 'sm-14', name: 'Teo Marchetti', tagline: null },
  { id: 'sm-15', name: 'Minjae Harlan', tagline: 'Ashlarine · Machine Learning Infrastructure Engineer, Serving and Routing' },
  { id: 'sm-16', name: 'Lucia Fennimore', tagline: 'Dillo Research · Systems Researcher' },
  { id: 'sm-17', name: 'Arjun Malhavi', tagline: 'Llano Outfitters · Senior Site Reliability Engineer' },
  { id: 'sm-18', name: 'Gideon Ashcombe', tagline: 'Hardscrabble Security · Founder' },
  { id: 'sm-19', name: 'Aidan O’Sheary', tagline: 'Edge Engineer at Rio Frio Agritech · Ten years of rural networks' },
  { id: 'sm-20', name: 'Ottavio Bellandi', tagline: 'Fiorandi Labs · Developer Relations Engineer and Docs Contributor' },
  { id: 'sm-21', name: 'Mateus Arraial', tagline: 'Greywater Analytics · Principal Engineer, Machine Learning Platforms' },
  { id: 'sm-22', name: 'Rosalind Vega Thornbury', tagline: 'Senior Engineer at Coldspring Robotics' },
  { id: 'sm-23', name: 'Wade Pettibone', tagline: 'Bandera GPU Works · Solutions Engineer' },
  { id: 'sm-24', name: 'Colby Ashendorf', tagline: 'Staff Engineer @ Lockhart Logistics' },
  { id: 'sm-25', name: 'Rekha Quint', tagline: 'Policywright · Security Engineer' },
  { id: 'sm-26', name: 'Ulises Barrientos Ocampo', tagline: 'Traceburrow · Principal Observability Engineer' },
  { id: 'sm-27', name: 'Saul Echeverri', tagline: 'Bramblegate · Founder and CEO · Community Organizer, Meetup Host and Occasional Podcast Guest.' },
];

type Slot = [title: string, speakers: string[], start: string, end: string, room: string, format: RawSession['format'], endUser?: true];

const slots: Slot[] = [
  ['Five Small Wins From a Year of Community Clusters', ['sm-1'], '09:15', '09:35', 'Room 1', 'keynote'],
  ['What a Shared Platform Owes the Teams Who Use It', ['sm-2'], '09:35', '09:55', 'Room 1', 'keynote'],
  ['Notes From the Night Shift', ['sm-3'], '09:55', '10:15', 'Room 1', 'keynote'],
  ['Ask the Platform: Building a Self-Service Portal Your Developers Actually Open', ['sm-4'], '10:30', '10:55', 'Room 1', 'talk'],
  ['Who Signed This Image? Tracing Artifacts Back to Source', ['sm-5'], '10:30', '10:55', 'Room 2', 'talk'],
  ['The Two-Hour Platform Sprint: Start From an Empty Cluster, Add Guardrails One by One, and Ship a Working Service.', ['sm-6'], '10:30', '12:00', 'Room 3', 'workshop'],
  ['One Scheduler for Everything: Running Batch Jobs, Services and Experiments Side by Side', ['sm-7'], '11:10', '11:35', 'Room 1', 'talk'],
  ['Moving a Freight Network’s Dispatch System to Kubernetes, One Depot at a Time', ['sm-8'], '11:10', '11:35', 'Room 2', 'talk', true],
  ['Smaller Prompts, Fewer Pages: Writing Runbooks People Read', ['sm-9'], '11:50', '12:15', 'Room 1', 'talk'],
  ['Release Trains Without the Drama: What We Changed After Fifty Rollbacks', ['sm-10'], '11:50', '12:15', 'Room 2', 'talk'],
  ['Moving Nightly Batch Jobs to Event-Driven Pipelines Without Losing a Single Record', ['sm-11'], '13:15', '13:40', 'Room 1', 'talk'],
  ['Quotas, Queues and Fair Shares: Splitting a Small Cluster Between Many Teams', ['sm-12'], '13:15', '13:40', 'Room 2', 'talk'],
  ['Hands-On Network Policies: Locking Down a Demo App', ['sm-13', 'sm-14'], '13:15', '14:45', 'Room 3', 'workshop'],
  ['Serving Models Close to the Data: Caching, Batching and Cold Starts in Practice', ['sm-15'], '13:55', '14:20', 'Room 1', 'talk'],
  ['Filesystems for People Who Run Containers', ['sm-16'], '13:55', '14:20', 'Room 2', 'talk'],
  ['Our Storage Bill Doubled in a Quarter: What We Measured and What We Cut', ['sm-17'], '14:35', '15:00', 'Room 1', 'talk', true],
  ['Postmortem Theater: Acting Out a Bad Deploy, Minute by Minute', ['sm-18'], '14:35', '15:00', 'Room 2', 'talk'],
  ['Clusters in the Field: Running Workloads on Tractors and Grain Elevators', ['sm-19'], '15:15', '15:40', 'Room 1', 'talk'],
  ['Startup Probes, Readiness and the Slow Java Service', ['sm-20'], '15:15', '15:40', 'Room 2', 'talk'],
  ['From Notebook to Endpoint: Packaging, Scaling and Monitoring a Small Model on Kubernetes - Workshop', ['sm-21', 'sm-22', 'sm-23'], '15:15', '16:45', 'Room 3', 'workshop'],
  ['Patching Ten Thousand Nodes: Self-Service Maintenance Windows for Many Tenants', ['sm-24'], '15:55', '16:20', 'Room 1', 'talk', true],
  ['Reading an Audit Log Like a Detective Novel', ['sm-25'], '15:55', '16:20', 'Room 2', 'talk'],
  ['Dashboards Nobody Reads and Alerts Everybody Ignores', ['sm-26'], '16:35', '17:00', 'Room 1', 'talk'],
  ['Writing Down How Your Team Works, and Keeping It True a Year Later', ['sm-27'], '16:35', '17:00', 'Room 2', 'talk'],
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
