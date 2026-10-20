"use client";
import React from "react";

interface TimeInput24Props {
  value?: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  allowEmpty?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

export default function TimeInput24({
  value,
  onChange,
  disabled = false,
  className = "",
  allowEmpty = false,
}: TimeInput24Props) {
  const cleanVal = (value || "").trim();
  const hasValue = Boolean(cleanVal);
  const [hRaw, mRaw] = cleanVal.split(":");
  const hNum = Number(hRaw);
  const mNum = Number(mRaw);

  const isValidH = cleanVal !== "" && !isNaN(hNum) && hNum >= 0 && hNum <= 23;
  const isValidM = cleanVal !== "" && !isNaN(mNum) && mNum >= 0 && mNum <= 59;

  let currentHour = "";
  let currentMinute = "";

  if (hasValue && isValidH) {
    currentHour = String(hNum).padStart(2, "0");
  } else if (!allowEmpty) {
    currentHour = "07";
  }

  if (hasValue && isValidM) {
    currentMinute = String(mNum).padStart(2, "0");
  } else if (!allowEmpty) {
    currentMinute = "30";
  }

  const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newH = e.target.value;
    if (!newH) {
      if (allowEmpty) {
        onChange("");
      }
      return;
    }
    const targetM = currentMinute || "00";
    onChange(`${newH}:${targetM}`);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newM = e.target.value;
    if (!newM && allowEmpty && !currentHour) {
      onChange("");
      return;
    }
    const targetH = currentHour || "08";
    const targetM = newM || "00";
    onChange(`${targetH}:${targetM}`);
  };

  return (
    <div
      className={`time-input-24 ${disabled ? "disabled" : ""} ${className}`}
      title="Format 24 Jam Indonesia (WIB - 00:00 s.d. 23:59)"
    >
      <div className="time-select-group">
        <select
          aria-label="Pilih Jam (00-23)"
          value={currentHour}
          disabled={disabled}
          onChange={handleHourChange}
          className="time-select-hour"
        >
          {allowEmpty && <option value="">--</option>}
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span className="time-separator">:</span>
        <select
          aria-label="Pilih Menit (00-59)"
          value={currentMinute}
          disabled={disabled}
          onChange={handleMinuteChange}
          className="time-select-minute"
        >
          {allowEmpty && <option value="">--</option>}
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <span className="time-wib-tag">WIB</span>
    </div>
  );
}
