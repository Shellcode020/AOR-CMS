
(() => {
  "use strict";

  const API_URL = "api/items.php";
  const PAGE_SIZE = 30;

  const $ = id => document.getElementById(id);

  const form = $("items-search-form");
  const queryInput = $("items-query");
  const qlInput = $("items-ql");
  const clearButton = $("items-clear");
  const resultsElement = $("items-results");
  const countElement = $("items-results-count");
  const paginationElement = $("items-pagination");
  const detailElement = $("items-detail");
  const statusElement = $("items-status");

  if (!form || !queryInput || !qlInput || !resultsElement || !detailElement) {
    console.error("Items database: required HTML elements are missing.");
    return;
  }

  // ------------------------------------------------------------
  // MODAL
  // ------------------------------------------------------------

  const modal = document.createElement("div");
  modal.className = "items-modal";
  modal.setAttribute("aria-hidden", "true");

  modal.innerHTML = `
    <div class="items-modal-dialog" role="dialog" aria-modal="true"
         aria-labelledby="items-modal-heading" tabindex="-1">
      <header class="items-modal-header">
        <h2 class="items-modal-heading" id="items-modal-heading">Item details</h2>
        <button type="button" class="items-modal-close"
                aria-label="Close item details" title="Close (Esc)">&times;</button>
      </header>
      <div class="items-modal-body"></div>
    </div>
  `;

  document.body.appendChild(modal);

  const modalBody = modal.querySelector(".items-modal-body");
  const modalClose = modal.querySelector(".items-modal-close");
  const originalDetailPanel = detailElement.closest(".items-panel");
  const originalDetailDisplay = originalDetailPanel
    ? originalDetailPanel.style.display
    : "";

  modalBody.appendChild(detailElement);
  detailElement.classList.remove("items-hidden");

  if (originalDetailPanel) originalDetailPanel.style.display = "none";

  let previousFocus = null;

  function openItemModal() {
    previousFocus = document.activeElement;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("items-modal-open");
    modalBody.scrollTop = 0;
    modalClose.focus();
  }

  function closeItemModal() {
    if (!modal.classList.contains("is-open")) return;

    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("items-modal-open");

    if (
      previousFocus &&
      typeof previousFocus.focus === "function" &&
      previousFocus.isConnected
    ) {
      previousFocus.focus();
    }
  }

  modalClose.addEventListener("click", closeItemModal);

  modal.addEventListener("click", event => {
    if (event.target === modal) closeItemModal();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && modal.classList.contains("is-open")) {
      closeItemModal();
    }
  });

  let currentPage = 1;
  let currentQuery = "";
  let currentQL = "";
  let currentItemId = null;
  let currentItems = [];
  let currentTotal = 0;
  let searchController = null;
  let searchRequestNumber = 0;
  let detailRequestNumber = 0;

  // ------------------------------------------------------------
  // STAT DEFINITIONS
  // ------------------------------------------------------------

  const REQUIREMENT_NAMES = {
    16: "Strength", 17: "Agility", 18: "Stamina",
    19: "Intelligence", 20: "Sense", 21: "Psychic",
37: "Title Level",
54: "Level",
  62: "Tokens",
    100: "Martial Arts", 101: "Multi Melee", 102: "1h Blunt",
    103: "1h Edged", 104: "Melee Energy", 105: "2h Edged",
    106: "Piercing", 107: "2h Blunt", 108: "Sharp Objects",
    109: "Grenade", 110: "Heavy Weapons", 111: "Bow",
    112: "Pistol", 113: "Rifle", 114: "MG / SMG",
    115: "Shotgun", 116: "Assault Rifle",
    118: "Melee Initiative", 119: "Ranged Initiative",
    120: "Physical Initiative", 121: "Bow Special Attack",
    122: "Sensory Improvement", 123: "First Aid",
    124: "Treatment", 125: "Mechanical Engineering",
    126: "Electrical Engineering", 127: "Material Metamorphosis",
    128: "Biological Metamorphosis", 129: "Psychological Modification",
    130: "Matter Creation", 131: "Space & Time", 132: "Nano Pool",
    133: "Ranged Energy", 134: "Multi Ranged", 135: "Trap Disarm",
    136: "Perception", 137: "Adventuring", 139: "Vehicle Air",
    141: "Tutoring", 142: "Brawl", 143: "Riposte", 144: "Dimach",
    145: "Parry", 146: "Sneak Attack", 147: "Fast Attack",
    148: "Burst", 149: "Nano Initiative", 150: "Fling Shot",
    151: "Aimed Shot", 152: "Body Development",
    153: "Duck Explosions", 154: "Dodge Ranged",
    155: "Evade Close Combat", 156: "Run Speed", 157: "Quantum FT",
    158: "Weapon Smithing", 159: "Pharmaceuticals",
    160: "Nano Programming", 161: "Computer Literacy",
    162: "Psychology", 163: "Chemistry", 164: "Concealment",
    165: "Breaking & Entry", 166: "Vehicle Ground",
    167: "Full Auto", 168: "Nano Resist", 181: "Max NCU",
    221: "Max Nano Energy"
  };

  const ATTACK_SKILL_NAMES = {
    100: "Martial Arts", 102: "1h Blunt", 103: "1h Edged",
    104: "Melee Energy", 105: "2h Edged", 106: "Piercing",
    107: "2h Blunt", 108: "Sharp Objects", 109: "Grenade",
    110: "Heavy Weapons", 111: "Bow", 112: "Pistol",
    113: "Rifle", 114: "MG / SMG", 115: "Shotgun",
    116: "Assault Rifle", 133: "Ranged Energy"
  };

  const MODIFIER_NAMES = {
    1: "Max Health",
    16: "Strength", 17: "Agility", 18: "Stamina",
    19: "Intelligence", 20: "Sense", 21: "Psychic",
    22: "Attack Rating", 26: "Energy", 27: "Health",
    45: "Belt Slots", 51: "Aggressive / Defensive",
    90: "Projectile AC", 91: "Melee AC", 92: "Energy AC",
    93: "Chemical AC", 94: "Radiation AC", 95: "Cold AC",
    96: "Poison AC", 97: "Fire AC",
    100: "Martial Arts", 101: "Multi Melee", 102: "1h Blunt",
    103: "1h Edged", 104: "Melee Energy", 105: "2h Edged",
    106: "Piercing", 107: "2h Blunt", 108: "Sharp Objects",
    109: "Grenade", 110: "Heavy Weapons", 111: "Bow",
    112: "Pistol", 113: "Rifle", 114: "MG / SMG",
    115: "Shotgun", 116: "Assault Rifle", 117: "Vehicle Water",
    118: "Melee Initiative", 119: "Ranged Initiative",
    120: "Physical Initiative", 121: "Bow Special Attack",
    122: "Sensory Improvement", 123: "First Aid", 124: "Treatment",
    125: "Mechanical Engineering", 126: "Electrical Engineering",
    127: "Material Metamorphosis", 128: "Biological Metamorphosis",
    129: "Psychological Modification", 130: "Matter Creation",
    131: "Space & Time", 132: "Nano Pool", 133: "Ranged Energy",
    134: "Multi Ranged", 135: "Trap Disarm", 136: "Perception",
    137: "Adventuring", 139: "Vehicle Air", 141: "Tutoring",
    142: "Brawl", 143: "Riposte", 144: "Dimach", 145: "Parry",
    146: "Sneak Attack", 147: "Fast Attack", 148: "Burst",
    149: "Nano Initiative", 150: "Fling Shot", 151: "Aimed Shot",
    152: "Body Development", 153: "Duck Explosions",
    154: "Dodge Ranged", 155: "Evade Close Combat",
    156: "Run Speed", 157: "Quantum FT", 158: "Weapon Smithing",
    159: "Pharmaceuticals", 160: "Nano Programming",
    161: "Computer Literacy", 162: "Psychology", 163: "Chemistry",
    164: "Concealment", 165: "Breaking & Entry",
    166: "Vehicle Ground", 167: "Full Auto", 168: "Nano Resist",
    181: "Max NCU", 205: "Reflect Projectile AC",
    206: "Reflect Melee AC", 207: "Reflect Energy AC",
    208: "Reflect Chemical AC", 214: "Current Nano",
    216: "Reflect Radiation AC", 217: "Reflect Cold AC",
    218: "Reflect Nano AC", 219: "Reflect Fire AC",
    221: "Max Nano Energy", 225: "Reflect Poison AC",
    226: "Projectile Damage Shield", 227: "Melee Damage Shield",
    228: "Energy Damage Shield", 229: "Chemical Damage Shield",
    230: "Radiation Damage Shield", 231: "Cold Damage Shield",
    233: "Fire Damage Shield", 234: "Poison Damage Shield",
    276: "Add All Offense", 277: "Add All Defense",
    315: "Nano Damage Modifier", 318: "Nano Cost",
    319: "Experience Modifier", 343: "Heal Delta",
    364: "Nano Delta", 379: "Critical Increase",
    380: "Weapon Range", 381: "Nano Range",
    382: "Skill Lock Modifier", 383: "Nano Interrupt Modifier",
    391: "Critical Resistance", 532: "Shadowbreed",
    535: "Heal Modifier", 536: "Nano Damage",
    593: "Regain Experience", 689: "Heal Reactivity Multiplier"
  };

  // ------------------------------------------------------------
  // GENERAL HELPERS
  // ------------------------------------------------------------

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;",
      '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function numberValue(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

function formatNumber(value) {
  const number = numberValue(value);
  return number === null ? "—" : String(number);
}

  function getValue(object, keys) {
    if (!object || typeof object !== "object") return undefined;

    for (const key of keys) {
      if (
        Object.prototype.hasOwnProperty.call(object, key) &&
        object[key] !== null &&
        object[key] !== undefined
      ) {
        return object[key];
      }
    }

    return undefined;
  }

  function getItemId(item) {
    return getValue(item, [
      "id", "item_id", "itemId", "aoid", "AOID", "ID"
    ]);
  }

  function getItemName(item) {
    return getValue(item, [
      "name", "item_name", "itemName", "Name"
    ]) || "Unknown item";
  }

  // Search nested item data for QL, but avoid walking arbitrary deep trees.
  function getItemQL(item) {
    const qlKeys = [
      "ql", "QL", "quality_level", "qualityLevel", "qualitylevel",
      "item_ql", "itemQL", "item_quality_level", "itemQualityLevel",
      "quality", "level", "Level", "item_level", "itemLevel"
    ];

    const visited = new Set();

    function findQL(value, depth) {
      if (!value || typeof value !== "object" || depth > 4 || visited.has(value)) {
        return undefined;
      }

      visited.add(value);

      const direct = getValue(value, qlKeys);
      if (direct !== undefined && direct !== null && direct !== "") {
        const parsed = numberValue(direct);
        if (parsed !== null) return parsed;
      }

      const preferredKeys = [
        "item", "Item", "data", "Data", "stats", "Stats",
        "properties", "Properties", "details", "Details",
        "result", "results"
      ];

      for (const key of preferredKeys) {
        if (value[key] && typeof value[key] === "object") {
          const result = findQL(value[key], depth + 1);
          if (result !== undefined) return result;
        }
      }

      return undefined;
    }

    return findQL(item, 0);
  }

  function getItemDescription(item) {
    return getValue(item, [
      "description", "item_description", "itemDescription", "Description"
    ]);
  }

  function setStatus(message, isError = false) {
    if (!statusElement) return;
    statusElement.textContent = message || "";
    statusElement.classList.toggle("error", Boolean(isError));
  }

  function setCount(message) {
    if (countElement) countElement.textContent = message || "";
  }

  function isObject(value) {
    return value !== null && typeof value === "object";
  }

  function normalizeArray(value) {
    if (Array.isArray(value)) return value;

    if (isObject(value)) {
      for (const key of [
        "items", "Items", "actions", "Actions",
        "criteria", "Criteria", "variants", "Variants"
      ]) {
        if (Array.isArray(value[key])) return value[key];
      }

      return Object.values(value).filter(isObject);
    }

    return [];
  }

  function getActions(item, propertyNames) {
    const source = getValue(item, propertyNames);

    if (Array.isArray(source)) return source;

    if (isObject(source)) {
      const nested = getValue(source, ["Actions", "actions"]);
      if (Array.isArray(nested)) return nested;
      return Object.values(source).filter(isObject);
    }

    return [];
  }

  function getActionId(action) {
    return numberValue(getValue(action, [
      "Action", "action", "action_id", "actionId", "id", "ID"
    ]));
  }

  function getCriteria(action) {
    return normalizeArray(getValue(action, [
      "Criteria", "criteria", "Conditions", "conditions"
    ]));
  }

  function getCriterionStat(criterion) {
    return numberValue(getValue(criterion, [
      "Value1", "value1", "stat", "Stat",
      "stat_id", "statId", "statID"
    ]));
  }

  function getCriterionValue(criterion) {
    return numberValue(getValue(criterion, [
      "Value2", "value2", "value", "Value", "amount", "Amount"
    ]));
  }

  function getCriterionOperator(criterion) {
    return numberValue(getValue(criterion, [
      "Operator", "operator", "operator_id", "operatorId"
    ]));
  }

  function getSpellGroups(item) {
    return getActions(item, [
      "spell_data", "spellData", "spells", "SpellData"
    ]);
  }

  // ------------------------------------------------------------
  // REQUIREMENTS
  // ------------------------------------------------------------

 
function getRequirements(item) {
  const actions = getActions(item, [
    "action_data", "actionData", "actions", "Actions"
  ]);

  const requirements = new Map();
  const relevantActions = new Set([3, 6, 8]);
  const dualWieldStats = new Set([101, 134]);

  for (const action of actions) {
    const actionId = getActionId(action);
    const criteria = getCriteria(action);

    // Dual-wield criteria can be stored under other action IDs.
    const containsDualWieldRequirement = criteria.some(criterion =>
      dualWieldStats.has(Number(getCriterionStat(criterion)))
    );

    if (
      actionId !== null &&
      !relevantActions.has(actionId) &&
      !containsDualWieldRequirement
    ) {
      continue;
    }

    for (const criterion of criteria) {
      const statId = getCriterionStat(criterion);
      const storedValue = getCriterionValue(criterion);
      const operator = getCriterionOperator(criterion);

      if (
        statId === null ||
        storedValue === null ||
        statId === 0 ||
        storedValue < 0
      ) {
        continue;
      }

      const name = REQUIREMENT_NAMES[statId];
      if (!name) continue;

      let minimum;

      // Dual-wield values represent the required skill directly.
      if (dualWieldStats.has(statId)) {
        minimum = storedValue;
      } else if (operator === 2) {
        // AO uses a greater-than check for these requirements.
        minimum = storedValue + 1;
      } else if (operator === 3) {
        minimum = storedValue;
      } else {
        continue;
      }

      if (!Number.isFinite(minimum) || minimum < 0) continue;

      const key = `${statId}:${name}`;
      const existing = requirements.get(key);

      if (!existing || minimum > existing.value) {
        requirements.set(key, {
          statId,
          name,
          value: minimum
        });
      }
    }
  }

  // Also read dual-wield requirements directly from item.stats.
  for (const requirement of getDualWieldRequirements(item)) {
    const key = `${requirement.statId}:${requirement.name}`;
    const existing = requirements.get(key);

    if (!existing || requirement.value > existing.value) {
      requirements.set(key, requirement);
    }
  }

  // Display Level first, then Title Level, then other requirements.
  const priority = {
    54: 0,
    37: 1
  };

  return [...requirements.values()].sort((a, b) => {
    const aPriority = priority[a.statId] ?? 2;
    const bPriority = priority[b.statId] ?? 2;

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    return a.name.localeCompare(b.name);
  });
}

function getDualWieldRequirements(item) {
  const stats = item?.stats ?? item?.Stats ?? {};
  const requirements = [];

  const multiMelee = Number(
    stats.MultiMelee ?? stats.MultiMeleeRequirement
  );

  const multiRanged = Number(
    stats.MultiRanged ?? stats.MultiRangedRequirement
  );

  if (Number.isFinite(multiMelee) && multiMelee > 0) {
    requirements.push({
      statId: 101,
      name: "Multi Melee",
      value: multiMelee
    });
  }

  if (Number.isFinite(multiRanged) && multiRanged > 0) {
    requirements.push({
      statId: 134,
      name: "Multi Ranged",
      value: multiRanged
    });
  }

  return requirements;
}


function getSideRequirement(item) {
  const value = getValue(item, ["side", "Side"]);

  if (typeof value !== "string") {
    return null;
  }

  const side = value.trim().replace(/\s+/g, " ");

  const allowedSides = [
    "Neutral",
    "Clan",
    "Omni",
    "Not Neutral",
    "Not Clan",
    "Not Omni"
  ];

  return allowedSides.find(
    allowed => allowed.toLowerCase() === side.toLowerCase()
  ) || null;
}

 
function renderRequirements(item) {
  const requirements = getRequirements(item);
  const profession = getProfession(item);
  const breed = getBreed(item);
  const side = getSideRequirement(item);

  if (!requirements.length && !profession && !breed && !side) {
    return "";
  }

  const specialRequirements = [];

  if (profession) {
    specialRequirements.push({
      name: "Profession",
      value: profession
    });
  }

  if (breed) {
    specialRequirements.push({
      name: "Breed",
      value: breed
    });
  }

  if (side) {
    specialRequirements.push({
      name: "Side",
      value: side
    });
  }

  return `
    <section class="item-section item-requirements">
      <h3>Requirements</h3>

      <ul class="item-stat-list">
        ${specialRequirements.map(requirement => `
          <li class="item-requirement-special">
            <span class="item-requirement-label">
              ${escapeHTML(requirement.name)}
            </span>

            <div class="item-requirement-values">
              ${String(requirement.value)
                .split(",")
                .map(value => value.trim())
                .filter(Boolean)
                .map(value => `
                  <span class="item-requirement-chip">
                    ${escapeHTML(value)}
                  </span>
                `).join("")}
            </div>
          </li>
        `).join("")}

        ${requirements.map(requirement => `
          <li>
            <span>${escapeHTML(requirement.name)}</span>
            <strong>${formatNumber(requirement.value)}</strong>
          </li>
        `).join("")}
      </ul>
    </section>
  `;
}




  // ------------------------------------------------------------
  // MODIFIERS
  // ------------------------------------------------------------

  function getSpellItems(group) {
    return normalizeArray(getValue(group, [
      "Items", "items", "Modifiers", "modifiers", "Effects", "effects"
    ]));
  }

  function getModifierStat(effect) {
    return numberValue(getValue(effect, [
      "Stat", "stat", "stat_id", "statId", "Value1", "value1"
    ]));
  }

  function getModifierAmount(effect) {
    return numberValue(getValue(effect, [
      "Amount", "amount", "Value", "value", "Value2", "value2"
    ]));
  }

  function getModifierDescription(effect) {
    const description = getValue(effect, [
      "SpellDescription", "spellDescription", "description", "Description"
    ]);
    return typeof description === "string" ? description.trim() : "";
  }

  function getModifiers(item) {
    const modifiers = new Map();

    for (const group of getSpellGroups(item)) {
      for (const effect of getSpellItems(group)) {
        const statId = getModifierStat(effect);
        const amount = getModifierAmount(effect);
        const description = getModifierDescription(effect);

        if (statId === null || !MODIFIER_NAMES[statId]) continue;
        if (amount === null || amount === 0) continue;

        const key = `${statId}:${amount}`;

        if (!modifiers.has(key)) {
          modifiers.set(key, {
            statId,
            name: MODIFIER_NAMES[statId],
            amount,
            description
          });
        }
      }
    }

    return [...modifiers.values()].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  function renderModifiers(item) {
    const modifiers = getModifiers(item);
    if (!modifiers.length) return "";

    return `
      <section class="item-section item-modifiers">
        <h3>Effects</h3>
        <ul class="item-stat-list">
          ${modifiers.map(modifier => `
            <li>
              <span>${escapeHTML(modifier.name)}</span>
              <strong>${modifier.amount > 0 ? "+" : ""}${formatNumber(modifier.amount)}</strong>
            </li>
          `).join("")}
        </ul>
      </section>
    `;
  }

  // ------------------------------------------------------------
  // ATTACK SKILLS
  // ------------------------------------------------------------

  function getAttackSkills(item) {
    const source = getValue(item, [
      "attack", "Attack", "attack_skills", "attackSkills",
      "attack_data", "attackData"
    ]);

    const candidates = [];

    if (Array.isArray(source)) {
      candidates.push(...source);
    } else if (isObject(source)) {
      if (getValue(source, ["Stat", "stat", "stat_id", "statId"]) !== undefined) {
        candidates.push(source);
      } else {
        candidates.push(...Object.values(source).filter(isObject));
      }
    }

    const skills = [];

    for (const candidate of candidates) {
      const statId = numberValue(getValue(candidate, [
        "Stat", "stat", "stat_id", "statId", "Value1", "value1"
      ]));

      const amount = numberValue(getValue(candidate, [
        "Amount", "amount", "Value", "value",
        "Value2", "value2", "percent"
      ]));

      if (statId === null || !ATTACK_SKILL_NAMES[statId]) continue;

      skills.push({
        statId,
        name: ATTACK_SKILL_NAMES[statId],
        amount
      });
    }

    return skills;
  }

  function renderAttackSkills(item) {
    const skills = getAttackSkills(item);
    if (!skills.length) return "";

    return `
      <section class="item-section">
        <h3>Attack skills</h3>
        <ul class="item-stat-list">
          ${skills.map(skill => `
            <li>
              <span>${escapeHTML(skill.name)}</span>
              <strong>${skill.amount === null ? "—" : `${formatNumber(skill.amount)}%`}</strong>
            </li>
          `).join("")}
        </ul>
      </section>
    `;
  }

  // ------------------------------------------------------------
  // ITEM PROPERTIES
  // ------------------------------------------------------------

  function formatPropertyValue(value) {
    if (value === undefined || value === null || value === "") return "";

    if (typeof value !== "object") return String(value);

    if (Array.isArray(value)) {
      return value.map(formatPropertyValue).filter(Boolean).join(", ");
    }

    const readableValue = getValue(value, [
      "name", "Name", "label", "Label", "display_name", "displayName",
      "slot_name", "slotName", "value", "Value", "description", "Description"
    ]);

    if (readableValue !== undefined && readableValue !== value) {
      return formatPropertyValue(readableValue);
    }

    return Object.values(value).map(formatPropertyValue).filter(Boolean).join(", ");
  }

  // ------------------------------------------------------------
  // LOOK FOR PROFESSION REQUIREMENT
  // ------------------------------------------------------------

function getCriterionOperator(criterion) {
  return numberValue(getValue(criterion, [
    "Operator", "operator", "operator_id", "operatorId"
  ]));
}


  // ------------------------------------------------------------
  // PROFESSION
  // ------------------------------------------------------------

  const PROFESSION_CRITERIA_IDS = new Set([60, 368]);

  // Anarchy Online profession IDs used in item requirements.
  const PROFESSION_NAMES = {
    1:  "Soldier",
    2:  "Martial Artist",
    3:  "Engineer",
    4:  "Fixer",
    5:  "Adventurer",
    6:  "Trader",
    7:  "Bureaucrat",
    8:  "Agent",
    9:  "Enforcer",
    10: "Doctor",
    11: "Nano-Technician",
    12: "Meta-Physicist",
    14: "Keeper",
    15: "Shade"
  };


  function getProfession(item) {
    const actions = getActions(item, [
      "action_data", "actionData", "actions", "Actions"
    ]);

    const professions = new Set();

    for (const action of actions) {
      for (const criterion of getCriteria(action)) {
        const statId = numberValue(getCriterionStat(criterion));
        const professionId = numberValue(getCriterionValue(criterion));

        if (!PROFESSION_CRITERIA_IDS.has(statId)) {
          continue;
        }

        if (
          Object.prototype.hasOwnProperty.call(
            PROFESSION_NAMES,
            professionId
          )
        ) {
          professions.add(PROFESSION_NAMES[professionId]);
        }
      }
    }

    return professions.size > 0
      ? [...professions].join(", ")
      : null;
  }


  // ------------------------------------------------------------
  // BREED REQUIREMENT
  // ------------------------------------------------------------

  const BREED_CRITERIA_IDS = new Set([4]);

  const BREED_NAMES = {
    1: "Solitus",
    2: "Opifex",
    3: "Nanomage",
    4: "Atrox"
  };


  function getBreed(item) {
    const actions = getActions(item, [
      "action_data", "actionData", "actions", "Actions"
    ]);

    const breeds = new Set();

    for (const action of actions) {
      for (const criterion of getCriteria(action)) {
        const statId = numberValue(getCriterionStat(criterion));
        const breedId = numberValue(getCriterionValue(criterion));

        if (!BREED_CRITERIA_IDS.has(statId)) {
          continue;
        }

        if (
          Object.prototype.hasOwnProperty.call(
            BREED_NAMES,
            breedId
          )
        ) {
          breeds.add(BREED_NAMES[breedId]);
        }
      }
    }

    return breeds.size > 0
      ? [...breeds].join(", ")
      : null;
  }


  // ------------------------------------------------------------
  // ITEM INFORMATION
  // ------------------------------------------------------------

  function getItemStats(item) {
    return item?.stats ?? item?.Stats ?? {};
  }

  function getItemStat(item, keys) {
    const stats = getItemStats(item);

    const value = getValue(stats, keys);
    if (value !== undefined) return value;

    return getValue(item, keys);
  }




function getHandLocation(item) {
  const itemClass = numberValue(getItemStat(item, [
    "ItemClass", "itemClass", "item_class"
  ]));

  const slot = numberValue(getItemStat(item, [
    "Slot", "slot"
  ])) ?? 0;

  const defaultSlot = numberValue(getItemStat(item, [
    "DefaultSlot", "defaultSlot", "default_slot"
  ]));

  // Check whether a specific Slot bit is present.
  const hasSlot = bit => (slot & bit) !== 0;

  // Return one or both locations for paired equipment slots.
  // If no relevant Slot flags are present, use DefaultSlot as a fallback.
  function getPairedLocation(rightBit, leftBit, rightName, leftName, fallback) {
    const right = hasSlot(rightBit);
    const left = hasSlot(leftBit);

    if (right && left) {
      return `${rightName} / ${leftName}`;
    }

    if (right) return rightName;
    if (left) return leftName;

    return fallback;
  }

  // ------------------------------------------------------------
  // WEAPONS
  // ------------------------------------------------------------

  if (itemClass === 1 && isWeapon(item)) {
    const rightHand = hasSlot(64);
    const leftHand = hasSlot(256);

    if (rightHand && leftHand) return "Dual Wield";
    if (rightHand) return "Right Hand";
    if (leftHand) return "Left Hand";

    return "Other";
  }

  // ------------------------------------------------------------
  // ARMOR, CLOTHING, RINGS AND ACCESSORIES
  // ------------------------------------------------------------

  if (itemClass === 2) {
    // Shoulder slot flags:
    // 16 = Right Shoulder
    // 64 = Left Shoulder
    if (defaultSlot === 4 || defaultSlot === 6) {
      const fallback = defaultSlot === 4
        ? "Right Shoulder"
        : "Left Shoulder";

      return getPairedLocation(
        16, 64,
        "Right Shoulder", "Left Shoulder",
        fallback
      );
    }

    // Arm slot flags:
    // 128 = Right Arm
    // 512 = Left Arm
    if (defaultSlot === 7 || defaultSlot === 9) {
      const fallback = defaultSlot === 7
        ? "Right Arm"
        : "Left Arm";

      return getPairedLocation(
        128, 512,
        "Right Arm", "Left Arm",
        fallback
      );
    }

    // Wrist slot flags:
    // 1024 = Right Wrist
    // 4096 = Left Wrist
    if (defaultSlot === 10 || defaultSlot === 12) {
      const fallback = defaultSlot === 10
        ? "Right Wrist"
        : "Left Wrist";

      return getPairedLocation(
        1024, 4096,
        "Right Wrist", "Left Wrist",
        fallback
      );
    }

    // Finger slot flags:
    // 8192 = Right Finger
    // 32768 = Left Finger
    //
    // Some rings have DefaultSlot 0, so recognize their Slot
    // flags even when DefaultSlot does not identify the finger slot.
    if (
      defaultSlot === 13 ||
      defaultSlot === 15 ||
      (defaultSlot === 0 && (hasSlot(8192) || hasSlot(32768)))
    ) {
      const fallback = defaultSlot === 15
        ? "Left Finger"
        : "Right Finger";

      return getPairedLocation(
        8192, 32768,
        "Right Finger", "Left Finger",
        fallback
      );
    }

    // Fixed armor slots.
    // These should not be inferred from the paired-slot flags.
    const armorSlots = {
      1: "Neck",
      2: "Head",
      3: "Back",
      5: "Chest",
      8: "Hands",
      11: "Legs",
      14: "Feet"
    };

    return armorSlots[defaultSlot] || "Other";
  }

  // ------------------------------------------------------------
  // IMPLANTS AND SYMBIANTS
  // ------------------------------------------------------------

  if (itemClass === 3) {
    const implantSlots = {
      1: "Eyes",
      2: "Head",
      3: "Ears",
      4: "Right Arm",
      5: "Chest",
      6: "Left Arm",
      7: "Right Wrist",
      8: "Waist",
      9: "Left Wrist",
      10: "Right Hand",
      11: "Legs",
      12: "Left Hand",
      13: "Feet"
    };

    return implantSlots[defaultSlot] || "Other";
  }

  // ------------------------------------------------------------
  // HUD, UTILS, DECK AND OTHER EQUIPMENT
  // ------------------------------------------------------------

  if (itemClass === 1) {
    const locations = [];

    // HUD and Utils slots.
    const equipmentSlots = [
      [1, "HUD 1"],
      [2, "HUD 2"],
      [4, "HUD 3"],
      [8, "Utils 1"],
      [16, "Utils 2"],
      [32, "Utils 3"]
    ];

    for (const [bit, label] of equipmentSlots) {
      if (hasSlot(bit)) {
        locations.push(label);
      }
    }

    // NCU Deck slots.
    // 512 through 16384 represent Deck 1 through Deck 6.
    const deckBits = [
      [512, 1],
      [1024, 2],
      [2048, 3],
      [4096, 4],
      [8192, 5],
      [16384, 6]
    ];

    const deckPositions = deckBits
      .filter(([bit]) => hasSlot(bit))
      .map(([, position]) => position);

    // Compact consecutive deck positions into readable ranges.
    if (deckPositions.length > 0) {
      const ranges = [];
      let start = deckPositions[0];
      let end = start;

      for (let i = 1; i < deckPositions.length; i++) {
        const position = deckPositions[i];

        if (position === end + 1) {
          end = position;
        } else {
          ranges.push(
            start === end
              ? `Deck ${start}`
              : `Deck ${start}–${end}`
          );

          start = position;
          end = position;
        }
      }

      ranges.push(
        start === end
          ? `Deck ${start}`
          : `Deck ${start}–${end}`
      );

      locations.push(...ranges);
    }

    // Belt / NCU component platform.
    if (hasSlot(128)) {
      locations.push("Deck");
    }

    // Non-weapon equipment that occupies a hand slot.
    const rightHand = hasSlot(64);
    const leftHand = hasSlot(256);

    if (rightHand && leftHand) {
      locations.push("Dual Wield");
    } else if (rightHand) {
      locations.push("Right Hand");
    } else if (leftHand) {
      locations.push("Left Hand");
    }

    if (locations.length > 0) {
      return [...new Set(locations)].join(" / ");
    }

    return "Other";
  }

  return "Other";
}


  function formatSeconds(value) {
    const number = numberValue(value);
    if (number === null || number < 0) return "—";

    // AO weapon timing stats are stored in hundredths of a second.
    return `${(number / 100).toFixed(2).replace(/\.?0+$/, "")} s`;
  }

  function getDamage(item) {
    const minDamage = numberValue(getItemStat(item, [
      "MinDamage", "minDamage", "Min_Damage", "min_damage"
    ]));

    const maxDamage = numberValue(getItemStat(item, [
      "MaxDamage", "maxDamage", "Max_Damage", "max_damage"
    ]));

    const criticalBonus = numberValue(getItemStat(item, [
      "CriticalBonus", "criticalBonus", "critical_bonus"
    ]));

    let damage;

    if (minDamage === null && maxDamage === null) {
      damage = "—";
    } else if (minDamage === null) {
      damage = formatNumber(maxDamage);
    } else if (maxDamage === null) {
      damage = formatNumber(minDamage);
    } else {
      damage = `${formatNumber(minDamage)} – ${formatNumber(maxDamage)}`;
    }

    if (criticalBonus !== null) {
      damage += ` (${formatNumber(criticalBonus)})`;
    }

    return damage;
  }



  function getProperties(item) {
    const weapon = isWeapon(item);

    const properties = [
      ["Damage", getDamage(item)],
      ["Location", getHandLocation(item)]
    ];

    if (weapon) {
      properties.push(
        ["Attack Time", formatSeconds(getItemStat(item, [
          "AttackDelay", "attackDelay", "AttackTime", "attack_time"
        ]))],
        ["Recharge Time", formatSeconds(getItemStat(item, [
          "RechargeDelay", "rechargeDelay", "RechargeTime", "recharge_time"
        ]))]
      );
    }

    return properties;
  }


  function renderProperties(item) {
    const properties = getProperties(item);

    const visibleProperties = properties.filter(([label, value]) => {
      if (
        value === "—" ||
        value === "" ||
        value === null ||
        value === undefined
      ) {
        return false;
      }

      if (label === "Location" && value === "Other") {
        return false;
      }

      return true;
    });

    if (!visibleProperties.length) return "";

    return `
      <section class="item-section item-information">
        <h3>Item Information</h3>
        <ul class="item-stat-list">
          ${visibleProperties.map(([label, value]) => `
            <li>
              <span>${escapeHTML(label)}</span>
              <strong>${escapeHTML(value)}</strong>
            </li>
          `).join("")}
        </ul>
      </section>
    `;
  }


  // ------------------------------------------------------------
  // ITEM TYPE DETECTION
  // ------------------------------------------------------------

  function isWeapon(item) {
    const name = String(getItemName(item)).toLowerCase();

    const weaponWords = [
      "rifle", "pistol", "shotgun", "sword", "blade", "spear",
      "hammer", "staff", "bow", "crossbow", "gun", "blaster",
      "launcher", "cannon", "weapon", "knife", "dagger",
      "shot", "carbine", "machine gun", "cleaver"
    ];

    return weaponWords.some(word => name.includes(word)) ||
      getAttackSkills(item).length > 0;
  }

  // ------------------------------------------------------------
  // VARIANTS
  // ------------------------------------------------------------

  function getVariants(item) {
    const variants = getValue(item, [
      "variants", "Variants", "ql_variants", "qlVariants"
    ]);

    if (Array.isArray(variants)) return variants;
    if (isObject(variants)) return Object.values(variants).filter(isObject);
    return [];
  }

  function renderVariants(item) {
    const variants = getVariants(item);
    if (!variants.length) return "";

    return `
      <section class="item-section">
        <h3>Variants</h3>
        <div class="item-variants">
          ${variants.map(variant => {
            const variantId = getItemId(variant);
            const variantName = getItemName(variant);
            const variantQL = getItemQL(variant);

            return `
              <button type="button" class="item-variant"
                      data-item-id="${escapeHTML(variantId ?? "")}">
                <span>${escapeHTML(variantName)}</span>
                ${variantQL !== undefined
                  ? `<span>QL ${escapeHTML(variantQL)}</span>`
                  : ""}
              </button>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  // ------------------------------------------------------------
  // TAGS
  // ------------------------------------------------------------


function getItemTags(item) {
  if (!Array.isArray(item?.tags)) {
    return [];
  }

  return item.tags.filter(tag =>
    ["NoDrop", "Unique", "Special"].includes(tag)
  );
}

function renderItemTags(item, className = "item-tags") {
  const tags = getItemTags(item);

  if (!tags.length) {
    return "";
  }

  return `
    <span class="${className}">
      ${tags.map(tag => `
        <span class="item-tag item-tag-${tag.toLowerCase()}">
          ${escapeHTML(tag)}
        </span>
      `).join("")}
    </span>
  `;
}

  // ------------------------------------------------------------
  // RENDER ITEM
  // ------------------------------------------------------------

  function renderItem(item) {
    if (!item || typeof item !== "object") {
      detailElement.innerHTML = `
        <div class="item-empty">No item details were returned.</div>
      `;
      return;
    }

    currentItemId = getItemId(item);

    const name = getItemName(item);
    const description = getItemDescription(item);
    const ql = getItemQL(item);
    const weapon = isWeapon(item);

const qlHTML = ql !== undefined && ql !== null
  ? `<span class="item-detail-ql">QL ${escapeHTML(ql)}</span>`
  : "";

    const descriptionHTML =
      typeof description === "string" && description.trim()
        ? `
          <section class="item-section">
            <h3>Description</h3>
            <p class="item-description">${escapeHTML(description)}</p>
          </section>
        `
        : "";

    detailElement.innerHTML = `
      <article class="item-detail-card">

<header class="item-detail-header">
  <div class="item-detail-title">
    <h2>${escapeHTML(name)}</h2>

    <div class="item-detail-badges">
      ${qlHTML}
      ${renderItemTags(item, "item-detail-tags")}
    </div>
  </div>
</header>

        <div class="item-detail-content">
          ${renderProperties(item)}
          ${renderRequirements(item)}
          ${weapon ? renderAttackSkills(item) : ""}
          ${renderModifiers(item)}
          ${renderVariants(item)}
          ${descriptionHTML}
        </div>
      </article>
    `;

    detailElement.querySelectorAll("[data-item-id]").forEach(button => {
      button.addEventListener("click", () => {
        const id = button.getAttribute("data-item-id");
        if (id) loadItem(id, true);
      });
    });
  }

  // ------------------------------------------------------------
  // SEARCH RESULTS
  // ------------------------------------------------------------

  function renderResults(items) {
    currentItems = Array.isArray(items) ? items : [];

    if (!currentItems.length) {
      resultsElement.innerHTML = `
        <div class="item-empty">No items found. Try another search or QL.</div>
      `;
      return;
    }

    resultsElement.innerHTML = currentItems.map(item => {
      const id = getItemId(item);
      const name = getItemName(item);
      const ql = getItemQL(item);

      const selected = currentItemId !== null &&
        String(currentItemId) === String(id);

      return `
        <button type="button"
                class="item-result${selected ? " active" : ""}"
                data-item-id="${escapeHTML(id ?? "")}"
                aria-pressed="${selected ? "true" : "false"}">
          ${ql !== undefined && ql !== null
            ? `<span class="item-result-meta">
                 <span class="item-result-ql">QL ${escapeHTML(ql)}</span>
               </span>`
            : ""}
          <span class="item-result-name">${escapeHTML(name)}</span>
${renderItemTags(item, "item-result-tags")}
        </button>
      `;
    }).join("");

    resultsElement.querySelectorAll("button[data-item-id]").forEach(button => {
      button.addEventListener("click", () => {
        const id = button.getAttribute("data-item-id");
        if (id) loadItem(id, true);
      });
    });
  }

  // ------------------------------------------------------------
  // PAGINATION
  // ------------------------------------------------------------

  function renderPagination() {
    if (!paginationElement) return;

    const totalPages = Math.max(1, Math.ceil(currentTotal / PAGE_SIZE));

    if (totalPages <= 1) {
      paginationElement.innerHTML = "";
      return;
    }

    paginationElement.innerHTML = `
      <div class="item-pagination-controls">
        <button type="button" class="item-page-button"
                data-page="${currentPage - 1}"
                ${currentPage <= 1 ? "disabled" : ""}>Previous</button>
        <span class="item-page-label">
          Page ${formatNumber(currentPage)} of ${formatNumber(totalPages)}
        </span>
        <button type="button" class="item-page-button"
                data-page="${currentPage + 1}"
                ${currentPage >= totalPages ? "disabled" : ""}>Next</button>
      </div>
    `;

    paginationElement.querySelectorAll("[data-page]").forEach(button => {
      button.addEventListener("click", () => {
        const page = numberValue(button.getAttribute("data-page"));

        if (
          page !== null &&
          page >= 1 &&
          page <= totalPages &&
          page !== currentPage
        ) {
          currentPage = page;
          searchItems();
        }
      });
    });
  }

  // ------------------------------------------------------------
  // URL STATE
  // ------------------------------------------------------------

  function updateURL() {
    const url = new URL(window.location.href);

    if (currentQuery) url.searchParams.set("q", currentQuery);
    else url.searchParams.delete("q");

    if (currentQL) url.searchParams.set("ql", currentQL);
    else url.searchParams.delete("ql");

    if (currentItemId !== null && currentItemId !== undefined) {
      url.searchParams.set("id", String(currentItemId));
    } else {
      url.searchParams.delete("id");
    }

    window.history.replaceState({}, "", url.toString());
  }

  // ------------------------------------------------------------
  // API
  // ------------------------------------------------------------

  async function fetchJSON(url, signal) {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal
    });

    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return response.json();
  }

  // ------------------------------------------------------------
  // SEARCH
  // ------------------------------------------------------------

  async function searchItems() {
    currentQuery = queryInput.value.trim();
    currentQL = qlInput.value.trim();

    const requestNumber = ++searchRequestNumber;

    if (searchController) searchController.abort();
    searchController = new AbortController();

    const params = new URLSearchParams();
    if (currentQuery) params.set("q", currentQuery);
    if (currentQL) params.set("ql", currentQL);
params.set("limit", String(PAGE_SIZE));
params.set("offset", String((currentPage - 1) * PAGE_SIZE));

    setStatus("Searching...");
    setCount("");

    try {
      const data = await fetchJSON(
        `${API_URL}?${params.toString()}`,
        searchController.signal
      );

      if (requestNumber !== searchRequestNumber) return;
      if (data && data.ok === false) {
        throw new Error(data.error || "The search request failed.");
      }

      const items = Array.isArray(data.items) ? data.items : [];
      currentTotal = numberValue(data.total) ?? items.length;

      renderResults(items);
      renderPagination();

      setCount(
        `${formatNumber(currentTotal)} item${currentTotal === 1 ? "" : "s"} found`
      );

      setStatus("");
      updateURL();
    } catch (error) {
      if (error.name === "AbortError") return;
      if (requestNumber !== searchRequestNumber) return;

      console.error("Item search failed:", error);

      resultsElement.innerHTML = `
        <div class="item-empty">Unable to load items. Please try again.</div>
      `;

      if (paginationElement) paginationElement.innerHTML = "";
      setCount("");
      setStatus(error.message || "Unable to load items.", true);
    }
  }

  // ------------------------------------------------------------
  // LOAD ITEM DETAILS
  // ------------------------------------------------------------

  async function loadItem(id, updateAddress = true) {
    if (id === undefined || id === null || String(id).trim() === "") {
      console.error("Cannot load item: missing item ID.");
      return;
    }

    const requestNumber = ++detailRequestNumber;
    setStatus("Loading item details...");

    try {
      const params = new URLSearchParams();
      params.set("id", String(id));

      const data = await fetchJSON(`${API_URL}?${params.toString()}`);

      if (requestNumber !== detailRequestNumber) return;

      if (data && data.ok === false) {
        throw new Error(data.error || "The API rejected the request.");
      }

      let item =
        data?.item ??
        data?.result ??
        data?.data?.item ??
        data?.data?.result ??
        (Array.isArray(data?.items) ? data.items[0] : null) ??
        (Array.isArray(data?.results) ? data.results[0] : null) ??
        data?.data ??
        null;

      if (
        !item &&
        data &&
        typeof data === "object" &&
        getItemId(data) !== undefined
      ) {
        item = data;
      }

      if (!item || typeof item !== "object") {
        throw new Error("No item was found in the API response.");
      }

      currentItemId = getItemId(item) ?? id;

      renderItem(item);
      detailElement.classList.remove("items-hidden");
      openItemModal();

      resultsElement.querySelectorAll("button[data-item-id]").forEach(button => {
        const selected =
          button.getAttribute("data-item-id") === String(currentItemId);

        button.classList.toggle("active", selected);
        button.setAttribute("aria-pressed", selected ? "true" : "false");
      });

      setStatus("");
      if (updateAddress) updateURL();
    } catch (error) {
      if (requestNumber !== detailRequestNumber) return;

      console.error("Loading item failed:", error);

      detailElement.innerHTML = `
        <div class="item-empty">
          Unable to load item details.<br>
          <small>${escapeHTML(error.message || "Unknown error")}</small>
        </div>
      `;

      detailElement.classList.remove("items-hidden");
      openItemModal();
      setStatus(error.message || "Unable to load item details.", true);
    }
  }

  // ------------------------------------------------------------
  // EVENT HANDLERS
  // ------------------------------------------------------------

  form.addEventListener("submit", event => {
    event.preventDefault();
    currentPage = 1;
    currentItemId = null;
    searchItems();
  });

  if (clearButton) {
    clearButton.addEventListener("click", () => {
      closeItemModal();

      queryInput.value = "";
      qlInput.value = "";
      currentQuery = "";
      currentQL = "";
      currentPage = 1;
      currentItemId = null;

      detailElement.innerHTML = `
        <div class="item-empty">Select an item to view its details.</div>
      `;

      detailElement.classList.remove("items-hidden");
      searchItems();
    });
  }

  // ------------------------------------------------------------
  // INITIALIZE FROM URL
  // ------------------------------------------------------------

  function initialize() {
    const params = new URLSearchParams(window.location.search);

    const initialQuery = params.get("q") || "";
    const initialQL = params.get("ql") || "";
    const initialId = params.get("id");

    queryInput.value = initialQuery;
    qlInput.value = initialQL;
    currentQuery = initialQuery;
    currentQL = initialQL;

    searchItems().then(() => {
      if (initialId) loadItem(initialId, false);
    });
  }

  initialize();
})();
