import { requestEmpty, requestJson } from "../../../shared/api/http-client";

export interface EventTeamItem {
  advancement: number;
  city: string;
  country: string;
  division: number;
  organizationSchool: string;
  teamName: string;
  teamNumber: number;
}

export interface EventTeamsResponse {
  eventCode: string;
  teams: EventTeamItem[];
}

export interface AddEventTeamPayload {
  city?: string;
  country?: string;
  organizationSchool?: string;
  teamName: string;
  teamNumber: number;
}

export interface UpdateEventTeamPayload {
  city?: string;
  country?: string;
  organizationSchool?: string;
  teamName: string;
}

interface AddEventTeamResponse {
  team: EventTeamItem;
}

interface ParsedCsvRow {
  lineNumber: number;
  payload: AddEventTeamPayload;
}

export interface ImportCsvIssue {
  lineNumber: number;
  message: string;
}

export interface ImportEventTeamsCsvResult {
  importedTeams: EventTeamItem[];
  issues: ImportCsvIssue[];
  parsedRows: number;
}

const CSV_HEADER_ALIASES = {
  city: ["city"],
  country: ["country"],
  organizationSchool: [
    "organizationschool",
    "organization",
    "org",
    "school",
    "organizationandschool",
    "organizationschoolname",
  ],
  teamName: ["teamname", "name"],
  teamNumber: ["teamnumber", "number", "teamno", "teamnum", "team"],
} as const;

const CSV_EXPORT_HEADERS = [
  "Team number",
  "Team name",
  "Organization / School",
  "City",
  "Country",
  "Advancement",
  "Division",
] as const;

const CSV_SPECIAL_CHARACTERS_REGEX = /[",\n\r]/;

const normalizeHeaderKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const escapeCsvField = (value: string): string => {
  if (!CSV_SPECIAL_CHARACTERS_REGEX.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
};

interface CsvRowWithLine {
  cells: string[];
  lineNumber: number;
}

interface CsvParserState {
  currentCell: string;
  currentRow: string[];
  isInQuotes: boolean;
  lineNumber: number;
  rowStartLineNumber: number;
  rows: CsvRowWithLine[];
}

const commitCsvRow = (state: CsvParserState): void => {
  state.currentRow.push(state.currentCell);
  state.rows.push({
    cells: state.currentRow,
    lineNumber: state.rowStartLineNumber,
  });
  state.currentRow = [];
  state.currentCell = "";
};

const consumeQuotedCsvCharacter = (
  csvText: string,
  index: number,
  state: CsvParserState
): number => {
  const character = csvText[index];
  if (character !== '"') {
    state.currentCell += character;
    if (character === "\n") {
      state.lineNumber += 1;
    }
    return index;
  }

  const nextCharacter = csvText[index + 1];
  if (nextCharacter === '"') {
    state.currentCell += '"';
    return index + 1;
  }

  state.isInQuotes = false;
  return index;
};

const consumeUnquotedCsvCharacter = (
  character: string,
  state: CsvParserState
): void => {
  if (character === '"') {
    state.isInQuotes = true;
    return;
  }

  if (character === ",") {
    state.currentRow.push(state.currentCell);
    state.currentCell = "";
    return;
  }

  if (character === "\r") {
    return;
  }

  if (character === "\n") {
    commitCsvRow(state);
    state.lineNumber += 1;
    state.rowStartLineNumber = state.lineNumber;
    return;
  }

  state.currentCell += character;
};

const parseCsvRows = (
  csvText: string
): Array<{ cells: string[]; lineNumber: number }> => {
  const normalizedCsvText =
    csvText.charCodeAt(0) === 0xfe_ff ? csvText.slice(1) : csvText;
  const state: CsvParserState = {
    currentCell: "",
    currentRow: [],
    isInQuotes: false,
    lineNumber: 1,
    rowStartLineNumber: 1,
    rows: [],
  };

  for (let index = 0; index < normalizedCsvText.length; index += 1) {
    if (state.isInQuotes) {
      index = consumeQuotedCsvCharacter(normalizedCsvText, index, state);
      continue;
    }

    consumeUnquotedCsvCharacter(normalizedCsvText[index], state);
  }

  commitCsvRow(state);

  return state.rows.filter((row) =>
    row.cells.some((cellValue) => cellValue.trim().length > 0)
  );
};

const parseCsvImportRows = (
  csvText: string
): { issues: ImportCsvIssue[]; rows: ParsedCsvRow[] } => {
  const rows = parseCsvRows(csvText);
  if (rows.length === 0) {
    return {
      rows: [],
      issues: [{ lineNumber: 1, message: "CSV file is empty." }],
    };
  }

  const headerCells = rows[0].cells.map((cellValue) =>
    normalizeHeaderKey(cellValue)
  );

  const findHeaderIndex = (aliases: readonly string[]): number => {
    const aliasSet = new Set(aliases);
    return headerCells.findIndex((headerCell) => aliasSet.has(headerCell));
  };

  const teamNumberColumnIndex = findHeaderIndex(CSV_HEADER_ALIASES.teamNumber);
  const teamNameColumnIndex = findHeaderIndex(CSV_HEADER_ALIASES.teamName);
  const organizationSchoolColumnIndex = findHeaderIndex(
    CSV_HEADER_ALIASES.organizationSchool
  );
  const cityColumnIndex = findHeaderIndex(CSV_HEADER_ALIASES.city);
  const countryColumnIndex = findHeaderIndex(CSV_HEADER_ALIASES.country);

  const issues: ImportCsvIssue[] = [];
  if (teamNumberColumnIndex < 0) {
    issues.push({
      lineNumber: rows[0].lineNumber,
      message: 'Missing required "team number" column.',
    });
  }
  if (teamNameColumnIndex < 0) {
    issues.push({
      lineNumber: rows[0].lineNumber,
      message: 'Missing required "team name" column.',
    });
  }
  if (issues.length > 0) {
    return { rows: [], issues };
  }

  const parsedRows: ParsedCsvRow[] = [];
  for (const row of rows.slice(1)) {
    const getCellValue = (columnIndex: number): string =>
      columnIndex < 0 ? "" : (row.cells[columnIndex] ?? "").trim();

    const teamNumberText = getCellValue(teamNumberColumnIndex);
    const teamName = getCellValue(teamNameColumnIndex);
    const organizationSchool = getCellValue(organizationSchoolColumnIndex);
    const city = getCellValue(cityColumnIndex);
    const country = getCellValue(countryColumnIndex);

    const isBlankRow = [
      teamNumberText,
      teamName,
      organizationSchool,
      city,
      country,
    ].every((value) => value.length === 0);
    if (isBlankRow) {
      continue;
    }

    const parsedTeamNumber = Number.parseInt(teamNumberText, 10);
    if (!Number.isInteger(parsedTeamNumber) || parsedTeamNumber <= 0) {
      issues.push({
        lineNumber: row.lineNumber,
        message: `Invalid team number "${teamNumberText}".`,
      });
      continue;
    }

    if (!teamName) {
      issues.push({
        lineNumber: row.lineNumber,
        message: "Team name is required.",
      });
      continue;
    }

    parsedRows.push({
      lineNumber: row.lineNumber,
      payload: {
        teamNumber: parsedTeamNumber,
        teamName,
        organizationSchool,
        city,
        country,
      },
    });
  }

  return { issues, rows: parsedRows };
};

export const fetchEventTeams = (
  eventCode: string,
  token: string,
  search: string
): Promise<EventTeamsResponse> => {
  const normalizedSearch = search.trim();
  const query = normalizedSearch
    ? `?search=${encodeURIComponent(normalizedSearch)}`
    : "";

  return requestJson<EventTeamsResponse>(
    `/events/${encodeURIComponent(eventCode)}/teams${query}`,
    {
      token,
    }
  );
};

export const addEventTeam = async (
  eventCode: string,
  payload: AddEventTeamPayload,
  token: string
): Promise<EventTeamItem> => {
  const response = await requestJson<AddEventTeamResponse>(
    `/events/${encodeURIComponent(eventCode)}/teams`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      token,
    }
  );

  return response.team;
};

export const updateEventTeam = async (
  eventCode: string,
  teamNumber: number,
  payload: UpdateEventTeamPayload,
  token: string
): Promise<EventTeamItem> => {
  const response = await requestJson<AddEventTeamResponse>(
    `/events/${encodeURIComponent(eventCode)}/teams/${encodeURIComponent(
      String(teamNumber)
    )}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      token,
    }
  );

  return response.team;
};

export const deleteEventTeam = async (
  eventCode: string,
  teamNumber: number,
  token: string
): Promise<void> => {
  await requestEmpty(
    `/events/${encodeURIComponent(eventCode)}/teams/${encodeURIComponent(
      String(teamNumber)
    )}`,
    {
      method: "DELETE",
      token,
    }
  );
};

export const buildTeamsCsv = (teams: EventTeamItem[]): string => {
  const headerRow = CSV_EXPORT_HEADERS.join(",");
  const bodyRows = teams.map((team) =>
    [
      team.teamNumber,
      team.teamName,
      team.organizationSchool,
      team.city,
      team.country,
      team.advancement,
      team.division,
    ]
      .map((value) => escapeCsvField(String(value ?? "")))
      .join(",")
  );

  return [headerRow, ...bodyRows].join("\n");
};

export const downloadTeamsCsv = (
  eventCode: string,
  teams: EventTeamItem[]
): void => {
  if (typeof window === "undefined") {
    throw new Error("CSV export is only available in a browser context.");
  }

  const csvContent = buildTeamsCsv(teams);
  const fileName = `${eventCode}-teams-${new Date().toISOString().slice(0, 10)}.csv`;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);

  const linkElement = document.createElement("a");
  linkElement.href = objectUrl;
  linkElement.download = fileName;
  linkElement.style.display = "none";

  document.body.appendChild(linkElement);
  linkElement.click();
  document.body.removeChild(linkElement);
  URL.revokeObjectURL(objectUrl);
};

export const importTeamsCsv = async (
  eventCode: string,
  csvText: string,
  token: string
): Promise<ImportEventTeamsCsvResult> => {
  const parsedResult = parseCsvImportRows(csvText);
  const importedTeams: EventTeamItem[] = [];
  const issues = [...parsedResult.issues];

  for (const row of parsedResult.rows) {
    try {
      const importedTeam = await addEventTeam(eventCode, row.payload, token);
      importedTeams.push(importedTeam);
    } catch (error) {
      issues.push({
        lineNumber: row.lineNumber,
        message:
          error instanceof Error ? error.message : "Failed to import team.",
      });
    }
  }

  return {
    importedTeams,
    issues,
    parsedRows: parsedResult.rows.length,
  };
};
