import { type ChangeEvent, useEffect, useRef, useState } from "react";
import {
  addEventTeam,
  deleteEventTeam,
  downloadTeamsCsv,
  type EventTeamItem,
  fetchEventTeams,
  importTeamsCsv,
  updateEventTeam,
} from "../../features/events/services/event-teams-service";
import { LoadingIndicator } from "../../shared/components/loading-indicator";
import {
  type PrintDestination,
  printTable,
} from "../../shared/services/print-service";
import "../../app/styles/components/teams.css";

interface TeamsPageProps {
  eventCode: string;
  token: string | null;
}

interface InlineTeamEditState {
  city: string;
  country: string;
  organizationSchool: string;
  teamName: string;
}

interface EditableTextCellProps {
  displayValue: string;
  fieldName: keyof InlineTeamEditState;
  isEditing: boolean;
  maxLength: number;
  onChange: (field: keyof InlineTeamEditState, value: string) => void;
  value: string;
}

const EditableTextCell = ({
  displayValue,
  fieldName,
  isEditing,
  maxLength,
  onChange,
  value,
}: EditableTextCellProps): JSX.Element => {
  if (!isEditing) {
    return <td>{displayValue}</td>;
  }

  return (
    <td>
      <input
        maxLength={maxLength}
        onChange={(event) => {
          onChange(fieldName, event.currentTarget.value);
        }}
        type="text"
        value={value}
      />
    </td>
  );
};

interface TeamTableRowProps {
  confirmDeleteTeamNumber: number | null;
  deletingTeamNumber: number | null;
  editingTeamDraft: InlineTeamEditState | null;
  editingTeamNumber: number | null;
  onCancelDelete: () => void;
  onCancelEdit: () => void;
  onDelete: (team: EventTeamItem) => void;
  onDraftFieldChange: (field: keyof InlineTeamEditState, value: string) => void;
  onSaveEdit: (teamNumber: number) => void;
  onStartEdit: (team: EventTeamItem) => void;
  savingTeamNumber: number | null;
  team: EventTeamItem;
}

const TeamTableRow = ({
  confirmDeleteTeamNumber,
  deletingTeamNumber,
  editingTeamDraft,
  editingTeamNumber,
  onCancelDelete,
  onCancelEdit,
  onDelete,
  onDraftFieldChange,
  onSaveEdit,
  onStartEdit,
  savingTeamNumber,
  team,
}: TeamTableRowProps): JSX.Element => {
  const isEditing = editingTeamNumber === team.teamNumber;
  const isSaving = savingTeamNumber === team.teamNumber;
  const isDeleting = deletingTeamNumber === team.teamNumber;
  const isConfirmingDelete = confirmDeleteTeamNumber === team.teamNumber;
  const disableActions =
    savingTeamNumber !== null ||
    deletingTeamNumber !== null ||
    (editingTeamNumber !== null && !isEditing);
  let actionControls: JSX.Element;

  if (isEditing) {
    actionControls = (
      <>
        <button
          disabled={isSaving || isDeleting}
          onClick={() => {
            onSaveEdit(team.teamNumber);
          }}
          type="button"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
        <button
          data-variant="secondary"
          disabled={isSaving || isDeleting}
          onClick={() => {
            onCancelEdit();
          }}
          type="button"
        >
          Cancel
        </button>
      </>
    );
  } else if (isConfirmingDelete) {
    actionControls = (
      <>
        <button
          data-variant="danger"
          disabled={isDeleting}
          onClick={() => {
            onDelete(team);
          }}
          type="button"
        >
          {isDeleting ? "Deleting..." : "Confirm Delete"}
        </button>
        <button
          data-variant="secondary"
          disabled={isDeleting}
          onClick={() => {
            onCancelDelete();
          }}
          type="button"
        >
          Cancel
        </button>
      </>
    );
  } else {
    actionControls = (
      <>
        <button
          data-variant="secondary"
          disabled={disableActions}
          onClick={() => {
            onStartEdit(team);
          }}
          type="button"
        >
          Edit
        </button>
        <button
          data-variant="danger"
          disabled={disableActions}
          onClick={() => {
            onDelete(team);
          }}
          type="button"
        >
          Delete
        </button>
      </>
    );
  }

  return (
    <tr>
      <td className="table-teams-team-number">{team.teamNumber}</td>
      <EditableTextCell
        displayValue={team.teamName}
        fieldName="teamName"
        isEditing={isEditing}
        maxLength={128}
        onChange={onDraftFieldChange}
        value={editingTeamDraft?.teamName ?? ""}
      />
      <EditableTextCell
        displayValue={team.organizationSchool || "-"}
        fieldName="organizationSchool"
        isEditing={isEditing}
        maxLength={128}
        onChange={onDraftFieldChange}
        value={editingTeamDraft?.organizationSchool ?? ""}
      />
      <EditableTextCell
        displayValue={team.city || "-"}
        fieldName="city"
        isEditing={isEditing}
        maxLength={64}
        onChange={onDraftFieldChange}
        value={editingTeamDraft?.city ?? ""}
      />
      <EditableTextCell
        displayValue={team.country || "-"}
        fieldName="country"
        isEditing={isEditing}
        maxLength={64}
        onChange={onDraftFieldChange}
        value={editingTeamDraft?.country ?? ""}
      />
      <td>{team.advancement}</td>
      <td>{team.division}</td>
      <td className="table-teams-actions">{actionControls}</td>
    </tr>
  );
};

export const TeamsPage = ({
  eventCode,
  token,
}: TeamsPageProps): JSX.Element => {
  const [teams, setTeams] = useState<EventTeamItem[]>([]);
  const [search, setSearch] = useState("");
  const [teamNumberInput, setTeamNumberInput] = useState("");
  const [teamName, setTeamName] = useState("");
  const [organizationSchool, setOrganizationSchool] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [editingTeamNumber, setEditingTeamNumber] = useState<number | null>(
    null
  );
  const [editingTeamDraft, setEditingTeamDraft] =
    useState<InlineTeamEditState | null>(null);
  const [savingTeamNumber, setSavingTeamNumber] = useState<number | null>(null);
  const [deletingTeamNumber, setDeletingTeamNumber] = useState<number | null>(
    null
  );
  const [confirmDeleteTeamNumber, setConfirmDeleteTeamNumber] = useState<
    number | null
  >(null);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(
    null
  );
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(
    null
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let isCancelled = false;
    if (!token) {
      setLoadErrorMessage("You must be logged in to view teams.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadErrorMessage(null);

    const timeoutId = window.setTimeout(() => {
      fetchEventTeams(eventCode, token, search)
        .then((response) => {
          if (!isCancelled) {
            setTeams(response.teams);
          }
        })
        .catch((error) => {
          if (!isCancelled) {
            setLoadErrorMessage(
              error instanceof Error ? error.message : "Failed to load teams."
            );
          }
        })
        .finally(() => {
          if (!isCancelled) {
            setIsLoading(false);
          }
        });
    }, 180);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [eventCode, search, token]);

  const handleAddTeam = async (): Promise<void> => {
    if (!token) {
      setSubmitErrorMessage("You must be logged in to add teams.");
      return;
    }

    const parsedTeamNumber = Number.parseInt(teamNumberInput.trim(), 10);
    if (!Number.isInteger(parsedTeamNumber) || parsedTeamNumber <= 0) {
      setSubmitErrorMessage("Team number must be a positive whole number.");
      return;
    }

    const trimmedTeamName = teamName.trim();
    if (!trimmedTeamName) {
      setSubmitErrorMessage("Team name is required.");
      return;
    }

    setIsSubmitting(true);
    setSubmitErrorMessage(null);
    setActionErrorMessage(null);
    setSuccessMessage(null);

    try {
      const createdTeam = await addEventTeam(
        eventCode,
        {
          teamNumber: parsedTeamNumber,
          teamName: trimmedTeamName,
          organizationSchool,
          city,
          country,
        },
        token
      );
      setSuccessMessage(
        `Saved team ${createdTeam.teamNumber} (${createdTeam.teamName}).`
      );
      setTeamNumberInput("");
      setTeamName("");
      setOrganizationSchool("");
      setCity("");
      setCountry("");
      const response = await fetchEventTeams(eventCode, token, search);
      setTeams(response.teams);
    } catch (error) {
      setSubmitErrorMessage(
        error instanceof Error ? error.message : "Failed to save team."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const startInlineEdit = (team: EventTeamItem): void => {
    setEditingTeamNumber(team.teamNumber);
    setEditingTeamDraft({
      teamName: team.teamName,
      organizationSchool: team.organizationSchool,
      city: team.city,
      country: team.country,
    });
    setConfirmDeleteTeamNumber(null);
    setActionErrorMessage(null);
    setSuccessMessage(null);
  };

  const cancelInlineEdit = (): void => {
    setEditingTeamNumber(null);
    setEditingTeamDraft(null);
  };

  const updateInlineDraftField = (
    field: keyof InlineTeamEditState,
    value: string
  ): void => {
    setEditingTeamDraft((current) =>
      current === null
        ? current
        : {
            ...current,
            [field]: value,
          }
    );
  };

  const handleSaveInlineEdit = async (teamNumber: number): Promise<void> => {
    if (!token) {
      setActionErrorMessage("You must be logged in to edit teams.");
      return;
    }

    if (!editingTeamDraft) {
      setActionErrorMessage("No team draft is available to save.");
      return;
    }

    const trimmedName = editingTeamDraft.teamName.trim();
    if (!trimmedName) {
      setActionErrorMessage("Team name is required.");
      return;
    }

    setSavingTeamNumber(teamNumber);
    setActionErrorMessage(null);
    setSuccessMessage(null);

    try {
      const updatedTeam = await updateEventTeam(
        eventCode,
        teamNumber,
        {
          teamName: trimmedName,
          organizationSchool: editingTeamDraft.organizationSchool,
          city: editingTeamDraft.city,
          country: editingTeamDraft.country,
        },
        token
      );

      setTeams((currentTeams) =>
        currentTeams.map((team) =>
          team.teamNumber === teamNumber ? updatedTeam : team
        )
      );
      setSuccessMessage(
        `Saved team ${updatedTeam.teamNumber} (${updatedTeam.teamName}).`
      );
      setConfirmDeleteTeamNumber(null);
      cancelInlineEdit();
    } catch (error) {
      setActionErrorMessage(
        error instanceof Error ? error.message : "Failed to save team changes."
      );
    } finally {
      setSavingTeamNumber(null);
    }
  };

  const handleDeleteRow = async (team: EventTeamItem): Promise<void> => {
    if (!token) {
      setActionErrorMessage("You must be logged in to delete teams.");
      return;
    }

    if (confirmDeleteTeamNumber !== team.teamNumber) {
      setConfirmDeleteTeamNumber(team.teamNumber);
      setActionErrorMessage(null);
      setSuccessMessage(null);
      return;
    }

    setDeletingTeamNumber(team.teamNumber);
    setActionErrorMessage(null);
    setSuccessMessage(null);

    try {
      await deleteEventTeam(eventCode, team.teamNumber, token);
      setTeams((currentTeams) =>
        currentTeams.filter((item) => item.teamNumber !== team.teamNumber)
      );
      if (editingTeamNumber === team.teamNumber) {
        cancelInlineEdit();
      }
      setConfirmDeleteTeamNumber(null);
      setSuccessMessage(`Deleted team ${team.teamNumber}.`);
    } catch (error) {
      setActionErrorMessage(
        error instanceof Error ? error.message : "Failed to delete team."
      );
    } finally {
      setDeletingTeamNumber(null);
    }
  };

  const cancelDeleteConfirmation = (): void => {
    if (deletingTeamNumber !== null) {
      return;
    }
    setConfirmDeleteTeamNumber(null);
  };

  const handleExportCsv = async (): Promise<void> => {
    if (!token) {
      setActionErrorMessage("You must be logged in to export CSV.");
      return;
    }

    setActionErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetchEventTeams(eventCode, token, "");
      downloadTeamsCsv(eventCode, response.teams);
      setSuccessMessage(`Exported ${response.teams.length} team(s) to CSV.`);
    } catch (error) {
      setActionErrorMessage(
        error instanceof Error ? error.message : "Failed to export CSV."
      );
    }
  };

  const handleImportCsvInputChange = async (
    event: ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const selectedFile = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = "";
    if (!selectedFile) {
      return;
    }

    if (!token) {
      setActionErrorMessage("You must be logged in to import CSV.");
      return;
    }

    setIsImportingCsv(true);
    setActionErrorMessage(null);
    setSuccessMessage(null);

    try {
      const csvText = await selectedFile.text();
      const result = await importTeamsCsv(eventCode, csvText, token);
      const refreshedTeams = await fetchEventTeams(eventCode, token, search);
      setTeams(refreshedTeams.teams);

      if (result.importedTeams.length > 0) {
        setSuccessMessage(
          `Imported ${result.importedTeams.length} team(s) from "${selectedFile.name}".`
        );
      } else if (result.issues.length === 0) {
        setSuccessMessage(`No team rows found in "${selectedFile.name}".`);
      }

      if (result.issues.length > 0) {
        const previewIssues = result.issues
          .slice(0, 5)
          .map((issue) => `Line ${issue.lineNumber}: ${issue.message}`)
          .join(" | ");
        const overflowMessage =
          result.issues.length > 5
            ? ` (${result.issues.length - 5} more issue(s) not shown).`
            : "";

        setActionErrorMessage(
          `CSV import completed with ${result.issues.length} issue(s). ${previewIssues}${overflowMessage}`
        );
      }
    } catch (error) {
      setActionErrorMessage(
        error instanceof Error ? error.message : "Failed to import CSV."
      );
    } finally {
      setIsImportingCsv(false);
    }
  };

  const handlePrintTeams = (destination: PrintDestination): void => {
    setActionErrorMessage(null);

    try {
      printTable<EventTeamItem>({
        destination,
        generatedAt: new Date().toISOString(),
        title: `${eventCode.toUpperCase()} Teams`,
        subtitle: "Team list",
        rows: teams,
        emptyMessage: "No teams found for this event.",
        columns: [
          { header: "Team #", formatValue: (row) => String(row.teamNumber) },
          { header: "Name", formatValue: (row) => row.teamName },
          {
            header: "Organization / School",
            formatValue: (row) => row.organizationSchool || "-",
          },
          { header: "City", formatValue: (row) => row.city || "-" },
          { header: "Country", formatValue: (row) => row.country || "-" },
          {
            header: "Advancement",
            formatValue: (row) => String(row.advancement),
          },
          { header: "Division", formatValue: (row) => String(row.division) },
        ],
      });
    } catch (error) {
      setActionErrorMessage(
        error instanceof Error ? error.message : "Failed to open print dialog."
      );
    }
  };

  if (isLoading && teams.length === 0) {
    return (
      <main className="page-shell page-shell--center">
        <LoadingIndicator />
      </main>
    );
  }

  if (loadErrorMessage && teams.length === 0) {
    return (
      <main className="page-shell page-shell--center">
        <div className="card surface-card surface-card--small stack stack--compact">
          <p className="message-block" data-variant="danger" role="alert">
            {loadErrorMessage}
          </p>
          <a className="app-link-inline" href={`/event/${eventCode}/dashboard`}>
            Back to Dashboard
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell page-shell--top">
      <section className="card surface-card surface-card--xlarge stack stack--compact">
        <header>
          <h2 className="app-heading">Add / Edit Teams - {eventCode}</h2>
          <p className="app-subheading">
            Fields used here: team number, name, organization/school, city,
            country. Other fields are stored with default values.
          </p>
          <p className="form-note">
            CSV import columns: Team number, Team name, Organization / School,
            City, Country. Print for paper, or use Export PDF.
          </p>
        </header>

        <div className="teams-actions-row">
          <div className="form-row">
            <label htmlFor="teams-search">Search teams</label>
            <input
              id="teams-search"
              onChange={(event) => {
                setSearch(event.currentTarget.value);
              }}
              placeholder="Search by number, name, organization/school, city, country"
              type="search"
              value={search}
            />
          </div>
          <div className="teams-actions-tools">
            <input
              accept=".csv,text/csv"
              className="teams-file-input"
              onChange={handleImportCsvInputChange}
              ref={csvInputRef}
              type="file"
            />
            <button
              data-variant="secondary"
              disabled={isImportingCsv}
              onClick={() => {
                csvInputRef.current?.click();
              }}
              type="button"
            >
              {isImportingCsv ? "Importing CSV..." : "Import CSV"}
            </button>
            <button
              data-variant="secondary"
              disabled={isImportingCsv}
              onClick={() => {
                handleExportCsv();
              }}
              type="button"
            >
              Export CSV
            </button>
            <button
              onClick={() => {
                handlePrintTeams("pdf");
              }}
              type="button"
            >
              Print / Export PDF
            </button>
            <a className="button" href={`/event/${eventCode}/dashboard`}>
              Back to Dashboard
            </a>
          </div>
        </div>

        {loadErrorMessage ? (
          <p className="message-block" data-variant="danger" role="alert">
            {loadErrorMessage}
          </p>
        ) : null}

        <div className="teams-form-grid">
          <div className="form-row">
            <label htmlFor="teamNumber">Team Number</label>
            <input
              id="teamNumber"
              inputMode="numeric"
              min={1}
              onChange={(event) => {
                setTeamNumberInput(event.currentTarget.value);
              }}
              placeholder="e.g. 24160"
              step={1}
              type="number"
              value={teamNumberInput}
            />
          </div>
          <div className="form-row">
            <label htmlFor="teamName">Team Name</label>
            <input
              id="teamName"
              maxLength={128}
              onChange={(event) => {
                setTeamName(event.currentTarget.value);
              }}
              placeholder="Team name"
              type="text"
              value={teamName}
            />
          </div>
          <div className="form-row">
            <label htmlFor="organizationSchool">Organization / School</label>
            <input
              id="organizationSchool"
              maxLength={128}
              onChange={(event) => {
                setOrganizationSchool(event.currentTarget.value);
              }}
              placeholder="Organization or school"
              type="text"
              value={organizationSchool}
            />
          </div>
          <div className="form-row">
            <label htmlFor="city">City</label>
            <input
              id="city"
              maxLength={64}
              onChange={(event) => {
                setCity(event.currentTarget.value);
              }}
              placeholder="City"
              type="text"
              value={city}
            />
          </div>
          <div className="form-row">
            <label htmlFor="country">Country</label>
            <input
              id="country"
              maxLength={64}
              onChange={(event) => {
                setCountry(event.currentTarget.value);
              }}
              placeholder="Country"
              type="text"
              value={country}
            />
          </div>
        </div>

        {submitErrorMessage ? (
          <p className="message-block" data-variant="danger" role="alert">
            {submitErrorMessage}
          </p>
        ) : null}

        {actionErrorMessage ? (
          <p className="message-block" data-variant="danger" role="alert">
            {actionErrorMessage}
          </p>
        ) : null}

        {successMessage ? (
          <output className="message-block" data-variant="success">
            {successMessage}
          </output>
        ) : null}

        <div className="form-actions">
          <button
            disabled={isSubmitting}
            onClick={() => {
              handleAddTeam();
            }}
            type="button"
          >
            {isSubmitting ? "Saving..." : "Add / Update Team"}
          </button>
        </div>

        <div className="table-wrap">
          <table className="table-credentials table-teams">
            <thead>
              <tr>
                <th scope="col">Team #</th>
                <th scope="col">Name</th>
                <th scope="col">Organization / School</th>
                <th scope="col">City</th>
                <th scope="col">Country</th>
                <th scope="col">Advancement</th>
                <th scope="col">Division</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teams.length > 0 ? (
                teams.map((team) => (
                  <TeamTableRow
                    confirmDeleteTeamNumber={confirmDeleteTeamNumber}
                    deletingTeamNumber={deletingTeamNumber}
                    editingTeamDraft={editingTeamDraft}
                    editingTeamNumber={editingTeamNumber}
                    key={team.teamNumber}
                    onCancelDelete={cancelDeleteConfirmation}
                    onCancelEdit={cancelInlineEdit}
                    onDelete={(selectedTeam) => {
                      handleDeleteRow(selectedTeam);
                    }}
                    onDraftFieldChange={updateInlineDraftField}
                    onSaveEdit={(teamNumber) => {
                      handleSaveInlineEdit(teamNumber);
                    }}
                    onStartEdit={(selectedTeam) => {
                      startInlineEdit(selectedTeam);
                    }}
                    savingTeamNumber={savingTeamNumber}
                    team={team}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={8}>No teams found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
};
