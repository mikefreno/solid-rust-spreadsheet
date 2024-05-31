import { getCellRefSplit, getColumnHeaderIndex } from "./utils";

export const isSelectedRow = (
  rowIndex: number,
  colIndex: number,
  selectedCellRef: string,
) => {
  const { colOfCell, rowOfCell } = getCellRefSplit(selectedCellRef);
  const selectedRowIndex = parseInt(rowOfCell) - 1;
  const selectedColIndex = getColumnHeaderIndex(colOfCell);
  return rowIndex === selectedRowIndex && colIndex <= selectedColIndex;
};

export const isSelectedColumn = (
  colIndex: number,
  rowIndex: number,
  selectedCellRef: string,
) => {
  const { colOfCell, rowOfCell } = getCellRefSplit(selectedCellRef);
  const selectedColIndex = getColumnHeaderIndex(colOfCell);
  const selectedRowIndex = parseInt(rowOfCell) - 1;
  return colIndex === selectedColIndex && rowIndex <= selectedRowIndex;
};
