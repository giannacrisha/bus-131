// ─────────────────────────────────────────────────────────────────────────────
// Course showcase data.
//
// TO ADD A NEW ACTIVITY OR ASSIGNMENT: append an entry to ACTIVITIES below.
// Everything on the site (nav, sections, counts, search) is derived from this
// file — no component changes needed.
// ─────────────────────────────────────────────────────────────────────────────

export type Entry = {
  /** Student name, as it should appear. */
  student: string;
  /** Optional project title the student gave their build. */
  title?: string;
  /** Public URL. Omit when the student has not shared a public link yet. */
  url?: string;
  /** Shown in place of a link when `url` is missing. */
  note?: string;
};

export type Activity = {
  /** URL-safe id, used for the in-page anchor. */
  id: string;
  /** e.g. "Assignment 2" */
  label: string;
  /** e.g. "Tetris" */
  title: string;
  /** One-line description shown under the heading. */
  blurb?: string;
  /** e.g. "Fall 2026" or a due date — free text. */
  term?: string;
  entries: Entry[];
};

export const COURSE = {
  code: 'BUS 131',
  name: 'Student Work',
  tagline: 'Apps built by students in class, shipped to the web.',
};

export const ACTIVITIES: Activity[] = [
  {
    id: 'assignment-2-tetris',
    label: 'Assignment 2',
    title: 'Tetris',
    blurb: 'Everyone built and deployed their own take on Tetris.',
    entries: [
      { student: 'Heidy Naranjo', title: 'Tetris Duel', url: 'https://tetrisapp.heidynaranjo.workers.dev' },
      { student: 'Denis', url: 'https://denis--tetris.pages.dev' },
      { student: 'Azami', title: 'DROPSHIFT', url: 'https://tetris.azami15091098805.workers.dev/' },
      { student: 'Enis', title: 'Jedi Temple Tetris', url: 'https://tetris.enis-78e.workers.dev/' },
      { student: 'Noam Reiner', url: 'https://bus131-tetris-demo.noamreiner.workers.dev/' },
      { student: 'T. Donnelly', title: 'STACKWARS', url: 'https://stackwarstetris-bus131a-donnellyyyy.tdonnelly.workers.dev/' },
      { student: 'Yonghao Chen', title: 'Purris', url: 'https://for-claude.yonghaochen.workers.dev/' },
      { student: 'A. Moskow', title: 'Mara Stack', url: 'https://mara-stack.amoskow.workers.dev' },
      { student: 'Doyin Ojerinola', title: 'Parlor', url: 'https://tetris-app-doyin.oojerinola.workers.dev/' },
      { student: 'Brandon Zhao', title: 'DOWNPOUR', url: 'https://assignment-2---tetris.brandonzhao.workers.dev/' },
      { student: 'Dolgorsureng', title: 'KABLOCK!', url: 'https://bus131-tetris.dolgorsureng.workers.dev/' },
      { student: 'Disha Basra', title: 'Berry Bitty Blocks', url: 'https://berry-bitty-blocks.dishabasra.workers.dev/' },
      { student: 'N. Chen', title: 'Purranormal', url: 'https://tetris.nchen-8c7.workers.dev/' },
      { student: 'Reya Aggarwal', title: 'Blockparty', url: 'https://bus-131---tetris---assignment-2.reyaaggarwal.workers.dev/' },
      { student: 'Joshua Arany', title: 'DATUM', url: 'https://bus131-tetris.joshuaarany.workers.dev/' },
      { student: 'Aydin K.', title: 'Tetrus', url: 'https://tetris-game.aydink.workers.dev' },
      { student: 'Jesse Degn', url: 'https://bus-131.jessedegn.workers.dev/' },
      { student: 'Eleanor Robinson', title: 'Tetris Together', url: 'https://tetris.eleanorrobinson.workers.dev/' },
      { student: 'Alex Zhang', url: 'https://bus-131a-tetris1.alexzhang-c50.workers.dev/' },
      { student: 'Jiayang Hu', title: 'Tetris: Gem Edition', url: 'https://bus131-tetris.jiayanghu.workers.dev' },
      { student: 'R. Kinoshita', title: 'Tetris Multiplayer', url: 'https://tetris-multiplayer-by-rk.rkinoshita.workers.dev' },
      { student: 'Julian Sharvey', url: 'https://bus131tetris.juliansharvey0.workers.dev/' },
      { student: 'Vitaly Chait', title: 'STACK/ATTACK', url: 'https://stack-attack.vitalychait.workers.dev/' },
      { student: 'E. Boutsikakis', title: 'Cable Stack', url: 'https://boutsikakis---tetris.eboutsikakis.workers.dev/' },
      { student: 'Dylan Walsh', url: 'https://dylan-walsh-tetris-game7.dylanwalsh.workers.dev/' },
      { student: 'Henry Aronwald', title: 'VERT LINES', url: 'https://vert-lines.henryaronwald.workers.dev' },
      { student: 'Nikiash', title: 'TETRA//AD', url: 'https://assignment.nikiash704.workers.dev/' },
      { student: 'Badalyan', url: 'https://bus131-figma-tetris1.badalyan-afa.workers.dev/' },
      { student: 'Sarah Clay', title: 'Aurora', url: 'https://aurora-tetris.sarahclay.workers.dev/' },
      { student: 'Yankun Zhang', title: 'Tetromancy', url: 'https://wizardstyletetrisgame.yankunzhang.workers.dev/' },
      { student: 'Unattributed', title: 'Stadium Stacker', url: 'https://tetris-2.pages.dev/' },
      { student: 'Unattributed', title: 'Sunset Stack', url: 'https://sunset-stack.pages.dev' },
      { student: 'Unattributed', title: 'StackRush', url: 'https://stackrush.stackrush.workers.dev/' },
      { student: 'Unattributed', title: 'Stonefall Tetris', note: 'Public link pending' },
      { student: 'Unattributed', title: 'Multiplayer Tetris', note: 'Public link pending' },
    ],
  },
  {
    id: 'other-builds',
    label: 'In class',
    title: 'Other builds',
    blurb: 'Side projects and in-class experiments.',
    entries: [
      { student: 'Unattributed', title: 'Neon Pong Arena', url: 'https://air-hockey-game.pages.dev' },
    ],
  },
];
