/**
 * Round-2 showcase QA: safe-area on single WA floats, clinic/travel grids,
 * cinematic mobile height, overflow-x guards.
 */
const fs = require("fs");
const path = require("path");

const demosDir = path.join(__dirname, "..", "public", "demos");

const SINGLE_WA = [
  "clinic.html",
  "salon.html",
  "restaurant.html",
  "school.html",
  "building.html",
  "carshowroom.html",
  "menssalon.html",
  "realestate.html",
];

const SAFE_WA = `
    .wa-float {
      bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px)) !important;
      right: max(1rem, env(safe-area-inset-right, 0px)) !important;
    }
`;

function patchFile(name, fn) {
  const file = path.join(demosDir, name);
  let html = fs.readFileSync(file, "utf8");
  const next = fn(html);
  if (next !== html) {
    fs.writeFileSync(file, next, "utf8");
    console.log("patched", name);
  } else {
    console.log("skip", name);
  }
}

for (const name of SINGLE_WA) {
  patchFile(name, (html) => {
    if (html.includes("Showcase QA: single WA safe-area")) return html;
    if (!html.includes(".wa-float")) return html;
    return html.replace(
      "</style>",
      `    /* Showcase QA: single WA safe-area */${SAFE_WA}  </style>`
    );
  });
}

patchFile("clinic.html", (html) => {
  if (html.includes("Showcase QA: clinic grids")) return html;
  return html.replace(
    "</style>",
    `    /* Showcase QA: clinic grids */
    @media (max-width: 480px) {
      .services-grid, .doctors-grid, .treat-grid, .why-grid, .cards-grid {
        grid-template-columns: 1fr !important;
      }
    }
  </style>`
  );
});

patchFile("travel.html", (html) => {
  if (html.includes("Showcase QA: travel narrow grids")) return html;
  return html.replace(
    "</style>",
    `    /* Showcase QA: travel narrow grids */
    @media (max-width: 480px) {
      .pkg-grid, .dest-grid, .hotel-grid, .exp-grid {
        grid-template-columns: 1fr !important;
      }
    }
  </style>`
  );
});

patchFile("carrental.html", (html) => {
  if (html.includes("Showcase QA: cinematic mobile")) return html;
  return html.replace(
    "</style>",
    `    /* Showcase QA: cinematic mobile */
    @media (max-width: 600px) {
      .cinematic { min-height: 320px; }
      .cinematic-content { padding: 1.25rem; gap: 0.85rem; }
      .section { padding-block: clamp(3rem, 8vw, 5.5rem); }
      #vehicle-detail.open ~ .wa-float,
      #vehicle-detail.open ~ .book-sticky { display: none !important; }
    }
  </style>`
  );
});

patchFile("it.html", (html) => {
  if (html.includes("minmax(min(100%, 280px)")) return html;
  return html.replace(
    /minmax\(280px,\s*1fr\)/g,
    "minmax(min(100%, 280px), 1fr)"
  );
});

console.log("done");
