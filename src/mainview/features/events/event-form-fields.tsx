export interface EventFormCommonFields {
  divisions: number;
  endDate: string;
  eventName: string;
  eventType: number;
  fields: number;
  region: string;
  startDate: string;
}

export type EventFormFieldChangeHandler = <
  K extends keyof EventFormCommonFields,
>(
  key: K,
  value: EventFormCommonFields[K]
) => void;

interface EventFormFieldsProps {
  endDateMin?: string;
  eventNamePlaceholder?: string;
  fieldsMax?: number;
  form: EventFormCommonFields;
  onFieldChange: EventFormFieldChangeHandler;
  regionPlaceholder?: string;
}

export const EventFormFields = ({
  endDateMin,
  eventNamePlaceholder,
  fieldsMax,
  form,
  onFieldChange,
  regionPlaceholder,
}: EventFormFieldsProps): JSX.Element => (
  <>
    <div className="form-row" data-field>
      <label htmlFor="eventName">Event Name</label>
      <input
        id="eventName"
        onChange={(e) => {
          onFieldChange("eventName", e.target.value);
        }}
        placeholder={eventNamePlaceholder}
        required
        type="text"
        value={form.eventName}
      />
    </div>

    <div className="form-row" data-field>
      <label htmlFor="region">Region</label>
      <input
        id="region"
        onChange={(e) => {
          onFieldChange("region", e.target.value);
        }}
        placeholder={regionPlaceholder}
        required
        type="text"
        value={form.region}
      />
    </div>

    <div className="form-grid-2">
      <div>
        <label htmlFor="startDate">Start Date</label>
        <input
          id="startDate"
          onChange={(e) => {
            onFieldChange("startDate", e.target.value);
          }}
          required
          type="date"
          value={form.startDate}
        />
      </div>
      <div>
        <label htmlFor="endDate">End Date</label>
        <input
          id="endDate"
          min={endDateMin}
          onChange={(e) => {
            onFieldChange("endDate", e.target.value);
          }}
          required
          type="date"
          value={form.endDate}
        />
      </div>
    </div>

    <div className="form-grid-2">
      <div>
        <label htmlFor="eventType">Event Type</label>
        <input
          id="eventType"
          min={0}
          onChange={(e) => {
            onFieldChange("eventType", Number(e.target.value));
          }}
          required
          type="number"
          value={form.eventType}
        />
      </div>
      <div>
        <label htmlFor="divisions">Divisions</label>
        <input
          id="divisions"
          min={1}
          onChange={(e) => {
            onFieldChange("divisions", Number(e.target.value));
          }}
          required
          type="number"
          value={form.divisions}
        />
      </div>
    </div>

    <div className="form-row" data-field>
      <label htmlFor="fields">Number of Fields</label>
      <input
        id="fields"
        max={fieldsMax}
        min={1}
        onChange={(e) => {
          onFieldChange("fields", Number(e.target.value));
        }}
        required
        type="number"
        value={form.fields}
      />
    </div>
  </>
);
