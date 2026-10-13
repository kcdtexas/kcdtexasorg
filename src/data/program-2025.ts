// The 2025 program as public data. The Sessions, Speakers, times (Central), rooms and formats come from the public
// 2025 Schedule (sources.schedule); the affiliations as printed on the 2025 Event Page (sources.eventPage), or on
// the Schedule for a Speaker the Event Page leaves out; the video IDs from the 2025 YouTube playlist
// (sources.playlist). The formats follow the Schedule's labels, and the keynotes are the three the Event Page
// and the 2025 transparency report name. Only these fields: no bios, no abstracts, no photos.
import { speakersOf, type PastSession, type PastSpeaker } from './past-program';

export const sources2025 = {
  schedule: 'https://kcdtexas2025.sessionize.com/',
  eventPage: 'https://community2.cncf.io/events/details/cncf-kcd-texas-presents-kcd-texas-austin-2025/',
  playlist: 'https://www.youtube.com/playlist?list=PL4UW_RgvzVchEiE5b6GnVQP2paAKYIIu1',
} as const;

export const sessions2025: readonly PastSession[] = [
  { title: 'Next Decade of Cloud Native - Celebrating 10 Years of Cloud Native Computing', speakers: [{ name: 'Chris Aniszczyk', printed: ['CNCF', 'CTO'] }], start: '2025-05-15T09:20', end: '2025-05-15T09:40', room: 'Main Stage', format: 'keynote', youtube: '1PmMTRt0TzM' },
  { title: 'K8s vs Agent Smith: Exploding GPUs and AI Security', speakers: [{ name: 'Andrew Martin', printed: ['Control Plane', 'CEO'] }], start: '2025-05-15T09:40', end: '2025-05-15T10:00', room: 'Main Stage', format: 'keynote', youtube: 'CLUqP0LJRo8' },
  { title: 'The Cloud Native Scientific Platform: Are We There Yet?', speakers: [{ name: 'Ricardo Rocha', printed: ['CERN', 'Member TOC + Member TAB at CNCF'] }], start: '2025-05-15T10:00', end: '2025-05-15T10:20', room: 'Main Stage', format: 'keynote', youtube: '4BUbq1hnVp0' },
  { title: 'Wasm Powered Open source LLMs and AI Agent', speakers: [{ name: 'Michael Yuan', printed: ['Second State(WasmEdge)'] }], start: '2025-05-15T10:30', end: '2025-05-15T10:55', room: 'Demonstration Room', format: 'talk', youtube: '_yjtYa8Gl5w' },
  { title: 'Streamline Development with IDPBuilder: Build an Internal Developer Platform in Minutes', speakers: [{ name: 'Gerardo Lopez Falcon', printed: ['Veritas Automata', 'Principal Engineer'] }, { name: 'Fabrizio Sgura', printed: ['Veritas Automata', 'Chief Engineer'] }], start: '2025-05-15T10:30', end: '2025-05-15T11:45', room: 'Workshop Gallery', format: 'workshop', youtube: null },
  { title: 'Choose Your Own Adventure: The Dignified Pursuit of a Developer Platform', speakers: [{ name: 'Whitney Lee', printed: ['Datadog', 'CNCF Ambassador, Senior Technical Advocate'] }, { name: 'Viktor Farcic', printed: ['Upbound', 'Developer Advocate & CNCF Ambassador'] }], start: '2025-05-15T10:30', end: '2025-05-15T10:55', room: 'Main Stage', format: 'talk', youtube: 'i-yUGFEedso' },
  { title: 'From Kubernetes to Chaos Mesh: How CNCF Projects Redefine Platform Resilience', speakers: [{ name: 'Elad Hirsch', printed: ['TeraSky', 'Tech Lead'] }], start: '2025-05-15T11:10', end: '2025-05-15T11:35', room: 'Demonstration Room', format: 'talk', youtube: 'sv32Pwqi9JY' },
  { title: 'Platform Engineering’s Missing Piece: A Deep Dive into Kubernetes Abstraction', speakers: [{ name: 'Engin Diri', printed: ['Pulumi', 'Community Engineer'] }], start: '2025-05-15T11:10', end: '2025-05-15T11:35', room: 'Main Stage', format: 'talk', youtube: '22s82xLN2E4' },
  { title: 'Build, Deploy, Run, and Iterate a Generative AI Application from Scratch', speakers: [{ name: 'Lin Sun', printed: ['Solo.io', 'Director of Open-Source'] }], start: '2025-05-15T11:50', end: '2025-05-15T12:15', room: 'Demonstration Room', format: 'talk', youtube: 'vf4-UxYZFkQ' },
  { title: 'Building an Edge Cloud Service Provider with Open Source', speakers: [{ name: 'Angel Ramirez', printed: ['Cuemby', 'CEO'] }], start: '2025-05-15T11:50', end: '2025-05-15T12:15', room: 'Workshop Gallery', format: 'talk', youtube: 'XrEDmwLWRTM' },
  { title: 'How Are You, Neighbor: Measuring Memory Interference in Cloud Native Systems', speakers: [{ name: 'Jonathan Perry', printed: ['OpenTelemetry'] }], start: '2025-05-15T11:50', end: '2025-05-15T12:15', room: 'Main Stage', format: 'talk', youtube: 'kbE-YqHTCSs' },
  { title: 'Harnessing Dapr Actors: Building Scalable Applications with Confidence', speakers: [{ name: 'Whit Waldo', printed: ['Innovian', 'Founder and CEO'] }], start: '2025-05-15T13:15', end: '2025-05-15T13:40', room: 'Demonstration Room', format: 'talk', youtube: 'mudomMIU4qM' },
  { title: 'Let\'s Do Bad Things to Unsecured Containers', speakers: [{ name: 'Gene Gotimer', printed: ['DevSecOps Engineer'] }], start: '2025-05-15T13:15', end: '2025-05-15T14:30', room: 'Workshop Gallery', format: 'workshop', youtube: null },
  { title: 'Kubernetes Autoscaling: Beyond One-Size-Fits-All', speakers: [{ name: 'John Platt', printed: ['StormForge', 'CTO'] }, { name: 'Lucas Duarte', printed: ['AWS', 'Sr. Specialist Solutions Architect, Containers'] }], start: '2025-05-15T13:15', end: '2025-05-15T13:40', room: 'Main Stage', format: 'talk', youtube: 'VDvEWWDHRSM' },
  { title: 'Accelerate Dev Teams with Platform Guardrails', speakers: [{ name: 'Chap Ambrose', printed: ['Heroku'] }], start: '2025-05-15T13:55', end: '2025-05-15T14:20', room: 'Demonstration Room', format: 'talk', youtube: '9m5vY-sB1Go' },
  { title: 'Beyond DevOps: How Kubernetes is Powering the Platform Engineering Era', speakers: [{ name: 'Timothy Serewicz', printed: ['The Linux Foundation', 'VP of Education'] }], start: '2025-05-15T13:55', end: '2025-05-15T14:20', room: 'Main Stage', format: 'talk', youtube: '1YyqkQeJubs' },
  { title: 'Policy-as-Code 101 - Securing your environments and Workloads using Kyverno', speakers: [{ name: 'Krishna Khandavilli', printed: ['Nirmata', 'Sr Customer Success Engineer'] }, { name: 'Sagar Kundral', printed: ['Nirmata', 'Customer Success Engineer'] }, { name: 'Dolis Sharma', printed: ['Nirmata', 'Customer Success Engineer'] }], start: '2025-05-15T14:35', end: '2025-05-15T15:50', room: 'Demonstration Room', format: 'workshop', youtube: 'J6EHaMEZ00k' },
  { title: 'Test the resiliency of your Kubernetes workloads', speakers: [{ name: 'Siva Guruvareddiar', printed: ['Solutions Architect with Amazon'] }], start: '2025-05-15T14:35', end: '2025-05-15T15:00', room: 'Workshop Gallery', format: 'talk', youtube: null },
  { title: 'Leveraging Helm Diff for Safer Kubernetes Deployments: A Guide for Developers', speakers: [{ name: 'Payal Godhani', printed: ['Oracle Cloud Infrastructure', 'Principal Member of Technical Staff'] }], start: '2025-05-15T14:35', end: '2025-05-15T15:00', room: 'Main Stage', format: 'talk', youtube: 'AZrEXY_9z2o' },
  { title: 'Future-Proof Foundations: Multi-Cloud Strategies for Robust Platform Development', speakers: [{ name: 'Lakmal Warusawithana', printed: ['WSO2', 'Technology Evangelist'] }], start: '2025-05-15T15:15', end: '2025-05-15T15:40', room: 'Main Stage', format: 'talk', youtube: null },
  { title: 'From pure chaos to embracing chaos engineering: how K8s has changed the way we architect software', speakers: [{ name: 'Benjamin Hindman', printed: ['reboot.dev', 'Founder'] }], start: '2025-05-15T15:55', end: '2025-05-15T17:10', room: 'Demonstration Room', format: 'workshop', youtube: 'E1JboaXWSlo' },
  { title: 'Hidden Signals in K8s Clusters: What Your Systems are Trying to Tell You', speakers: [{ name: 'Mickael Alliel', printed: ['Komodor', 'Backend Tech Lead'] }], start: '2025-05-15T15:55', end: '2025-05-15T16:20', room: 'Main Stage', format: 'talk', youtube: 'W3MUo05FCLg' },
  { title: 'Optimizing Distributed Databases on Kubernetes with KEDA, Prometheus, and Karpenter', speakers: [{ name: 'Bo Guan', printed: ['AWS', 'Senior Solutions Architect'] }, { name: 'Ratnopam Chakrabarti', printed: ['AWS', 'Sr. Solutions Architect'] }], start: '2025-05-15T16:35', end: '2025-05-15T17:00', room: 'Main Stage', format: 'talk', youtube: 'jSA31uTuC84' },
];

/** Every 2025 Speaker once, in program order. */
export const speakers2025: readonly PastSpeaker[] = speakersOf(sessions2025);

// The hosts, from the 2025 Event Page's Hosts section. They aren't on the Schedule.
export const hosts2025: readonly PastSpeaker[] = [
  { name: 'Lisa-Marie Namphy', printed: ['CNCF Ambassador, DevRel Architect'] },
  { name: 'Danielle Cook', printed: ['CNCF Ambassador, Co-Organizer, Cartografos Working Group'] },
];
