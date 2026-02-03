const { getState } = require("@saltcorn/data/db/state");
const View = require("@saltcorn/data/models/view");
const User = require("@saltcorn/data/models/user");
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
    const user = await User.findOne({ role_id: 80 });
    const admin = await User.findOne({ role_id: 1 });
    table.min_role_write = 80;
    table.min_role_read = 80;
    table.versioned = true;
    await table.update(table);
    const mid = await table.insertRow(
      { author: "Moore", pages: 257, publisher: 1 },
      user,
    );
    const aid = await table.insertRow(
      { author: "Apostol", pages: 411, publisher: 2 },
      admin,
    );
    await table.updateRow({ pages: 258 }, mid, user);
    await table.updateRow({ pages: 431 }, aid, admin);
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
    const allrows = await histbooks.getRows({});
    expect(allrows.length).toBe(4);
    const user = await User.findOne({ role_id: 80 });

    const usersrows = await histbooks.getRows({}, { forUser: user });
    expect(usersrows.length).toBe(2);
  });
  it("get joined rows", async () => {
    const histbooks = Table.findOne("HistBooks");

    const allrows = await histbooks.getJoinedRows({
      where: { author: "Apostol" },
      joinFields: {
        publisher_name: {
          target: "name",
          ref: "publisher",
        },
      },
    });
    expect(allrows.length).toBe(2);
    expect(allrows[0].publisher_name).toBe("No starch");
    const user = await User.findOne({ role_id: 80 });

    const usersrows = await histbooks.getJoinedRows({
      where: {},
      joinFields: {
        publisher_name: {
          target: "name",
          ref: "publisher",
        },
      },
      forUser: user,
    });
    expect(usersrows.length).toBe(2);
    expect(usersrows[0].publisher_name).toBe("AK Press");

  });
});
