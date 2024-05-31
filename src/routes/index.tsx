import { createSignal, createEffect, onMount } from "solid-js";
import {
  isSelectedRow,
  isSelectedColumn,
} from "../utils/SpreadSheetHighlighter";
import { loadData, saveData } from "../utils/SpreadSheetFileFunctions";
import { Cell, getColumnHeader } from "~/utils/utils";
import init, { Spreadsheet } from "~/wasm/pkg/wasm_trie";

const COLUMNS = 100;
const ROWS = 100;

export default function SpreadsheetEditor() {
  const [data, setData] = createSignal<Spreadsheet>();
  const [selectedCell, setSelectedCell] = createSignal<string>("");
  const [inputBarValue, setInputBarValue] = createSignal<string>("");
  const [spreadsheetName, setSpreadsheetName] = createSignal<string>("");
  const [showModal, setShowModal] = createSignal(false);

  // Function to initialize the spreadsheet with empty cells
  const initializeSpreadsheet = (data?: Spreadsheet) => {
    if (data) {
      setData(data);
    } else {
      const spreadsheet = new Spreadsheet();
      setData(spreadsheet);
    }
  };

  createEffect(() => {
    const refStr = selectedCell();
    const cell: Cell = data()?.get_cell(refStr);
    if (cell) {
      setInputBarValue(cell.formula ? cell.formula : cell.value);
    } else {
      setInputBarValue("");
    }
  });

  onMount(async () => {
    await init();
    initializeSpreadsheet();
  });

  return (
    <>
      {showModal() && (
        <div class="fixed z-10 inset-0 overflow-y-auto">
          <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div class="fixed inset-0 transition-opacity" aria-hidden="true">
              <div class="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span
              class="hidden sm:inline-block sm:align-middle sm:h-screen"
              aria-hidden="true"
            >
              &#8203;
            </span>
            <div
              class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-headline"
            >
              <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <label>Enter spreadsheet name:</label>
                <input
                  type="text"
                  value={spreadsheetName()}
                  onInput={(e) => setSpreadsheetName(e.target.value)}
                />
              </div>
              <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => {
                    setShowModal(false);
                    saveData(spreadsheetName(), setShowModal, data());
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div class="bg-green-100 h-12 py-1 z-30 fixed justify-center w-full">
        <button
          class="text-blue-500 hover:text-blue-700 font-bold py-2 px-4 underline"
          onClick={() => saveData(spreadsheetName(), setShowModal, data())}
        >
          Save
        </button>
        <label class="text-blue-500 hover:text-blue-700 font-bold py-2 px-4 underline cursor-pointer">
          Load
          <input
            type="file"
            class="hidden"
            onChange={(e) =>
              e.target.files &&
              loadData(
                e.target.files[0],
                initializeSpreadsheet,
                setSpreadsheetName,
              )
            }
          />
        </label>
        <button class="text-blue-500 hover:text-blue-700 font-bold py-2 px-4 underline">
          Options
        </button>
        <button
          class="font-bold absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2"
          onClick={() => setShowModal(true)}
        >
          {spreadsheetName()}
        </button>
      </div>
      <div class="min-w-full flex justify-center fixed bg-white mt-12 z-20 pt-0.5">
        <input
          type="text"
          class="hover:bg-gray-200 bg-white border border-gray-400 my-2 w-1/2 min-h-4 text-lg"
          value={inputBarValue() ?? ""}
          onInput={(e) => {
            const value = (e.target as HTMLInputElement).value;
            setInputBarValue(value);
          }}
          onBlur={(e) => {
            const value = (e.target as HTMLInputElement).value;
            setData(data()?.set_cell_value(selectedCell(), value));
          }}
          onKeyPress={(e) => {
            if (e.key === "Enter") {
              const value = (e.target as HTMLInputElement).value;
              setData(data()?.set_cell_value(selectedCell(), value));
            }
          }}
        />
      </div>
      <div
        class="grid z-10 sticky top-24"
        style={{
          "grid-template-columns": `40px repeat(${COLUMNS}, minmax(48px, 1fr))`,
        }}
      >
        <div class="min-h-4 p-1 border border-gray-400" />
        {[...Array(COLUMNS)].map((_, colIndex) => (
          <div
            class={`${
              isSelectedColumn(colIndex, 0, selectedCell())
                ? "bg-green-100"
                : "bg-gray-100"
            } min-h-4 p-1 border border-gray-400 text-center font-bold`}
          >
            {getColumnHeader(colIndex)}
          </div>
        ))}
      </div>
      <div class="pt-24">
        {Array.from({ length: ROWS }, (_, rowIndex) => (
          <div
            class="grid"
            style={{
              "grid-template-columns": `40px repeat(${COLUMNS}, minmax(48px, 1fr))`,
            }}
          >
            <div
              class={`border border-gray-400 p-1 text-center font-bold min-h-4 sticky left-0 z-10 bg-gray-100 ${
                isSelectedRow(rowIndex, 0, selectedCell()) ? "bg-green-100" : ""
              }`}
            >
              {rowIndex + 1}
            </div>
            {data() &&
              Array.from({ length: COLUMNS }, (_, colIndex) => {
                const refStr = `${getColumnHeader(colIndex)}${rowIndex + 1}`;
                const cell = data()?.get_cell_split(colIndex, rowIndex);
                return cell ? (
                  <input
                    type="text"
                    class={`border min-w-12 min-h-4 ${
                      isSelectedColumn(colIndex, rowIndex, selectedCell()) &&
                      isSelectedRow(rowIndex, colIndex, selectedCell())
                        ? "bg-green-200 border-green-400"
                        : isSelectedColumn(
                            colIndex,
                            rowIndex,
                            selectedCell(),
                          ) || isSelectedRow(rowIndex, colIndex, selectedCell())
                        ? "bg-green-100 border-gray-400 hover:bg-gray-200"
                        : "border-gray-400 hover:bg-gray-200"
                    }`}
                    value={cell.value}
                    onFocus={(e) => {
                      setSelectedCell(refStr);
                      setInputBarValue(
                        cell.formula
                          ? cell.formula
                          : (e.target as HTMLInputElement).value,
                      );
                    }}
                    onInput={(e) => {
                      const value = (e.target as HTMLInputElement).value;
                      setInputBarValue(value);
                    }}
                    onChange={(e) => {
                      const value = (e.target as HTMLInputElement).value;
                      setData(data()?.set_cell_value(refStr, value));
                    }}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        const value = (e.target as HTMLInputElement).value;
                        setData(data()?.set_cell_value(refStr, value));
                      }
                    }}
                  />
                ) : (
                  <input
                    type="text"
                    class={`border min-w-12 min-h-4 ${
                      isSelectedColumn(colIndex, rowIndex, selectedCell()) &&
                      isSelectedRow(rowIndex, colIndex, selectedCell())
                        ? "bg-green-200 border-green-400"
                        : isSelectedColumn(
                            colIndex,
                            rowIndex,
                            selectedCell(),
                          ) || isSelectedRow(rowIndex, colIndex, selectedCell())
                        ? "bg-green-100 border-gray-400 hover:bg-gray-200"
                        : "border-gray-400 hover:bg-gray-200"
                    }`}
                    onFocus={(e) => {
                      setSelectedCell(refStr);
                      data()?.init_cell(refStr, "");
                    }}
                    onInput={(e) => {
                      const value = (e.target as HTMLInputElement).value;
                      setInputBarValue(value);
                    }}
                    onChange={(e) => {
                      const value = (e.target as HTMLInputElement).value;
                      if (
                        value.startsWith("=") ||
                        data()?.get_dependencies(refStr).length > 0
                      ) {
                        setData(data()?.set_cell_value(refStr, value));
                      } else {
                        data()?.set_cell_value(refStr, value);
                      }
                    }}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        const value = (e.target as HTMLInputElement).value;
                        setData(data()?.set_cell_value(refStr, value));
                      }
                    }}
                  />
                );
              })}
          </div>
        ))}
      </div>
    </>
  );
}
