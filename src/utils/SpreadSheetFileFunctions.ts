import { type Setter } from "solid-js";
import {
  Cell,
  getCellRefSplit,
  getColumnHeaderIndex,
  getColumnHeader,
} from "./utils";
import pkg from "file-saver";
const { saveAs } = pkg;
import Papa from "papaparse";
import { Spreadsheet } from "~/wasm/pkg/wasm_trie";

export const saveData = (
  spreadsheetName: string | undefined,
  setShowModal: Setter<boolean>,
  data: Spreadsheet,
) => {
  if (!spreadsheetName) {
    setShowModal(true);
  } else if (data) {
    // To determine the last row and column, parse the cell keys
    let lastRow = -1;
    let lastCol = -1;
    for (const key of Object.keys(data)) {
      const { colOfCell, rowOfCell } = getCellRefSplit(key);
      const colIdx = getColumnHeaderIndex(colOfCell);
      const row = parseInt(rowOfCell) - 1;
      if (data?.get_cell(key)?.value !== "") {
        lastRow = Math.max(lastRow, row);
        lastCol = Math.max(lastCol, colIdx);
      }
    }

    const csvData: string[][] = Array.from({ length: lastRow + 1 }, () =>
      Array(lastCol + 1).fill(""),
    );

    for (const key of Object.keys(data)) {
      const match = key.match(/([A-Z]+)(\d+)/);
      if (match) {
        const col = getColumnHeaderIndex(match[1]);
        const row = parseInt(match[2], 10) - 1;
        if (row <= lastRow && col <= lastCol) {
          const cell = data.get_cell(key);
          csvData[row][col] = cell?.formula ? cell.formula : cell?.value ?? "";
        }
      }
    }

    const csvString = Papa.unparse(csvData);
    const blob = new Blob([csvString], { type: "text/csv" });
    saveAs(blob, `${spreadsheetName}.csv`);
  }
};

export const loadData = (
  file: File,
  ROWS: number,
  COLUMNS: number,
  initializeSpreadsheet: (
    rows: number,
    cols: number,
    data?: Spreadsheet,
  ) => void,
  setSpreadsheetName: Setter<string>,
) => {
  const reader = new FileReader();
  reader.onload = (event) => {
    const csvString = event.target?.result as string;
    const result = Papa.parse(csvString, {
      header: false,
    });
    const loadedData = new Spreadsheet();
    const dataArray = result.data as Array<string[]>;

    dataArray.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        const col = getColumnHeader(colIndex);
        const rowStr = (rowIndex + 1).toString();

        const cellData: Cell = {
          value: cell,
          formula: null,
        };

        loadedData.init_cell(col + rowStr, cell);
      });
    });

    initializeSpreadsheet(ROWS, COLUMNS, loadedData);
    setSpreadsheetName(file.name.replace(".csv", ""));
  };
  reader.readAsText(file);
};
