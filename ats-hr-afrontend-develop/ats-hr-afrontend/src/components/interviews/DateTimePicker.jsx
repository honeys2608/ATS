import React from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

export default function DateTimePicker({ value, onChange }) {
  return (
    <DatePicker
      selected={value ? new Date(value) : null}
      onChange={(date) => onChange(date ? date.toISOString() : "")}
      showTimeInput // ✅ free time input (no intervals)
      timeInputLabel="Time:"
      dateFormat="dd/MM/yyyy hh:mm aa"
      placeholderText="dd/MM/yyyy hh:mm AM"
      minDate={new Date()}
      className="border rounded px-3 py-2 w-full text-sm"
    />
  );
}
