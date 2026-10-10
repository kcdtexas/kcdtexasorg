// The KCD Texas part of the 2024 program, co-located with Texas Linux Fest, as public data. The Sessions, Speakers
// and their affiliations as printed, times (Central), rooms and formats come from the public KCD Texas 2024
// Schedule (sources.schedule), which Texas Linux Fest's KCD page links as the full schedule (sources.tlfKcd).
// The two keynotes are the morning block that Texas Linux Fest's schedule prints as "KCD Keynote". The one
// recording is in the 2024 YouTube playlist (sources.playlist). A person in the 2026 data appears under the name
// the site prints for 2026. Only these fields: no bios, no abstracts, no photos.
import { speakersOf, type PastSession, type PastSpeaker } from './past-program';

export const sources2024 = {
  schedule: 'https://kcd-texas.sessionize.com/',
  tlfKcd: 'https://2024.texaslinuxfest.org/kcd/',
  tlfSchedule: 'https://2024.texaslinuxfest.org/schedule/',
  eventPage: 'https://community2.cncf.io/events/details/cncf-kcd-texas-presents-kcd-texas-2024-austin/',
  playlist: 'https://www.youtube.com/playlist?list=PL4UW_RgvzVciC3QJibPbh5TF1Vene25Ot',
} as const;

export const sessions2024: readonly PastSession[] = [
  { title: 'The Future of Cloud Native', speakers: [{ name: 'Chris Aniszczyk', printed: ['CTO at CNCF, VP at Linux Foundation, Executive Director at Open Container Initiative (OCI)'] }], start: '2024-04-12T09:00', end: '2024-04-12T09:25', room: 'Room 4', format: 'keynote', youtube: null },
  { title: 'Open Source Dynamics in the Era of License Innovation', speakers: [{ name: 'Andrew Martin', printed: ['Founder & CTO Controlplane'] }], start: '2024-04-12T09:25', end: '2024-04-12T09:50', room: 'Room 4', format: 'keynote', youtube: 'daFFuemPUk0' },
  { title: 'Phippy’s Field Guide to Wasm', speakers: [{ name: 'Karen Chu', printed: ['Head of Community at Fermyon Technologies'] }, { name: 'Matt Butcher', printed: ['CEO'] }], start: '2024-04-12T10:00', end: '2024-04-12T10:25', room: 'Room 4', format: 'talk', youtube: null },
  { title: 'Ephemeral Environments: Redefining Pre-Production', speakers: [{ name: 'Natalie Lunbeck', printed: ['DevRel Engineer at Shipyard'] }], start: '2024-04-12T10:00', end: '2024-04-12T10:25', room: 'Room 5', format: 'talk', youtube: null },
  { title: 'Closing The Gap: Extending Kubernetes from Cloud to Edge with WebAssembly', speakers: [{ name: 'Joonas Bergius', printed: ['Senior Engineer at Cosmonic'] }], start: '2024-04-12T10:30', end: '2024-04-12T10:55', room: 'Room 4', format: 'talk', youtube: null },
  { title: 'Lessons Learned hosting 1800 customer instances in 8 K8s Clusters', speakers: [{ name: 'Bob Walker', printed: ['Field CTO at Octopus Deploy'] }], start: '2024-04-12T10:30', end: '2024-04-12T10:55', room: 'Room 5', format: 'talk', youtube: null },
  { title: 'Korell8r - Signal Correlation for Kubernetes and Beyond', speakers: [{ name: 'Jamie Prince', printed: ['Product Manager at Red Hat'] }, { name: 'Alan Conway', printed: ['Red Hat'] }], start: '2024-04-12T11:00', end: '2024-04-12T11:25', room: 'Room 4', format: 'talk', youtube: null },
  { title: 'Crossplane for Platform Engineers', speakers: [{ name: 'Steven Borrelli', printed: ['Principal Soutions Architect, Upbound'] }], start: '2024-04-12T11:00', end: '2024-04-12T11:25', room: 'Room 5', format: 'talk', youtube: null },
  { title: 'The Past, Present and Future of Gateway API', speakers: [{ name: 'Shane Utt', printed: ['Staff Software Engineer @ Kong, SIG Network Chair, Gateway API Maintainer'] }], start: '2024-04-12T11:30', end: '2024-04-12T11:55', room: 'Room 4', format: 'talk', youtube: null },
  { title: '5g Core Testing with the CNF TestSuite', speakers: [{ name: 'W Watson', printed: ['Vulk Coop'] }], start: '2024-04-12T11:30', end: '2024-04-12T11:55', room: 'Room 5', format: 'talk', youtube: null },
  { title: 'Kubernetes Kickstart Boosting Agility with CNCF and DevOps', speakers: [{ name: 'Angel Ramirez', printed: ['CEO @ Cuemby | FHCN Co-Founder, Guest Speaker, CNCF Ambassador'] }], start: '2024-04-12T13:00', end: '2024-04-12T14:30', room: 'Room 5', format: 'workshop', youtube: null },
  { title: 'Demystifying Kubernetes Resource Management', speakers: [{ name: 'Rafael Brito', printed: ['Staff Engineer - StormForge'] }], start: '2024-04-12T14:40', end: '2024-04-12T16:10', room: 'Room 5', format: 'workshop', youtube: null },
  { title: 'Sidecar containers in Kubernetes: Past, Present, and Future', speakers: [{ name: 'William Morgan', printed: ['co-founder and CEO of Buoyant'] }], start: '2024-04-12T15:35', end: '2024-04-12T16:00', room: 'Room 4', format: 'talk', youtube: null },
  { title: 'Navig8.dev: a Helm Chart Values Wizard', speakers: [{ name: 'Mark Lavi', printed: ['Open Source Cloud Native Product Manager, Kasten by Veeam'] }, { name: 'Satheesh Mohandass', printed: ['Solutions Architect, Veeam Kasten'] }], start: '2024-04-12T16:10', end: '2024-04-12T16:15', room: 'Room 4', format: 'lightning', youtube: null },
  { title: 'Acing the Prometheus Exam: A Kubernetes Observability Journey', speakers: [{ name: 'Rajeshkumar Sampathrajan', printed: ['An observability enthusiast and engineering manager'] }], start: '2024-04-12T16:15', end: '2024-04-12T16:20', room: 'Room 4', format: 'lightning', youtube: null },
  { title: 'Mini-CTF Workshop', speakers: [{ name: 'Andrew Martin', printed: ['CEO, ControlPlane'] }], start: '2024-04-12T16:15', end: '2024-04-12T16:40', room: 'Room 5', format: 'talk', youtube: null },
  { title: 'On-Prem is the New Black: Repatriating Data From The Cloud', speakers: [{ name: 'Cece Chef', printed: ['Developer Evangelist'] }], start: '2024-04-12T16:20', end: '2024-04-12T16:25', room: 'Room 4', format: 'lightning', youtube: null },
  { title: 'Building Container Images at Scale with Cloud Native Buildpacks', speakers: [{ name: 'Terence Lee', printed: ['Heroku'] }], start: '2024-04-12T16:25', end: '2024-04-12T16:30', room: 'Room 4', format: 'talk', youtube: null },
];

/** Every 2024 Speaker once, in program order. */
export const speakers2024: readonly PastSpeaker[] = speakersOf(sessions2024);

// The hosts, from the 2024 Event Page's Hosts section. They aren't on the Schedule.
export const hosts2024: readonly PastSpeaker[] = [
  { name: 'Emily Gupton', printed: ['Austin Women in Technology'] },
  { name: 'Sarah Williams', printed: ['Austin Women in Technology'] },
  { name: 'Laura Santamaria', printed: [] },
];
