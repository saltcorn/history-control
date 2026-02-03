const { getState } = require("@saltcorn/data/db/state");
const View = require("@saltcorn/data/models/view");
const Table = require("@saltcorn/data/models/table");
const Field = require("@saltcorn/data/models/field");
const { mockReqRes } = require("@saltcorn/data/tests/mocks");
const { afterAll, beforeAll, describe, it, expect } = require("@jest/globals");

/* 
 
 RUN WITH:
  saltcorn dev:plugin-test -d ~/history-control
 
 */

afterAll(require("@saltcorn/data/db").close);
beforeAll(async () => {
  await require("@saltcorn/data/db/reset_schema")();
  await require("@saltcorn/data/db/fixtures")();

  getState().registerPlugin("base", require("@saltcorn/data/base-plugin"));
  getState().registerPlugin("@saltcorn/history-control", require(".."));
});

describe("History table provider", () => {
  it("activate version history for books", async () => {
    const table = Table.findOne({ name: "books" });

    table.versioned = true;
    await table.update(table);
    const mid = await table.insertRow({ author: "Moore", pages: 257 });
    const aid = await table.insertRow({ author: "Apostol", pages: 411 });
    await table.updateRow({ pages: 258 }, mid);
    await table.updateRow({ pages: 431 }, aid);
    const histRows = await table.get_history();
    expect(histRows.length).toBe(4);
  });
  it("create provided table", async () => {
    const histbooks = await Table.create("HistBooks", {
      provider_name: "History for database table",
      provider_cfg: {
        table: "books",
      },
      ownership_formula: "_userid ===user.id",
    });
    const nrows = await histbooks.countRows({});
    expect(nrows).toBe(4);
  });
});
