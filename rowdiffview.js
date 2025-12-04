const Field = require("@saltcorn/data/models/field");
const Table = require("@saltcorn/data/models/table");
const Form = require("@saltcorn/data/models/form");
const User = require("@saltcorn/data/models/user");
const View = require("@saltcorn/data/models/view");
const { hashState } = require("@saltcorn/data/utils");
const Workflow = require("@saltcorn/data/models/workflow");
const HtmlDiff = require("htmldiff-js");
const {
  text,
  div,
  h3,
  style,
  a,
  script,
  pre,
  domReady,
  p,
  i,
  select,
  option,
  h2,
  button,
} = require("@saltcorn/markup/tags");
const { radio_group, checkbox_group } = require("@saltcorn/markup/helpers");
const moment = require("moment");

const get_state_fields = () => [
  {
    name: "id",
    type: "Integer",
    required: true,
    primary_key: true,
  },
];

const configuration_workflow = (req) =>
  new Workflow({
    steps: [
      {
        name: "Difference View",
        form: async (context) => {
          const table = await Table.findOne({ id: context.table_id });
          const show_views = await View.find_table_views_where(
            context.table_id,
            ({ state_fields, viewtemplate, viewrow }) =>
              viewtemplate.runMany &&
              viewrow.name !== context.viewname &&
              state_fields.some((sf) => sf.name === "id")
          );
          const show_view_opts = show_views.map((v) => v.select_option);
          return new Form({
            fields: [
              {
                name: "show_view",
                label: req.__("Single item view"),
                type: "String",
                sublabel:
                  req.__("The underlying individual view of each table row") +
                  ". " +
                  a(
                    {
                      "data-dyn-href": `\`/viewedit/config/\${show_view}\``,
                      target: "_blank",
                    },
                    req.__("Configure")
                  ),
                required: true,
                attributes: {
                  options: show_view_opts,
                },
              },
              {
                name: "min_interval_secs",
                label: "Minimum interval (s)",
                type: "Integer",
              },
              {
                name: "date_format",
                label: "Date format",
                type: "String",
                sublabel: "moment.js format specifier",
              },
            ],
          });
        },
      },
    ],
  });

const run = async (
  table_id,
  viewname,
  { show_view, min_interval_secs, date_format },
  state,
  extraArgs
) => {
  const table = await Table.findOne({ id: table_id });
  const stateHash = hashState(state, show_view);

  const id = state[table.pk_name];

  if (!id) return `Need id`;

  let hist = await table.get_history(id);

  let last = 0;
  let last_changed_by = undefined;
  hist = hist.filter((row) => {
    const myEpoch = Math.round(new Date(row._time).getTime() / 1000);
    if (
      myEpoch - last > min_interval_secs ||
      (row._userid && row._userid !== last_changed_by)
    ) {
      //include
      last = myEpoch;
      last_changed_by = row._userid;
      return true;
    } else return false;
  });

  if (!hist || !hist.length) return "No versions recorded";
  hist = hist.reverse();

  const userIds = new Set(hist.map((h) => h._userid));
  const users = await User.find({ id: { in: [...userIds] } });
  const emails = {};
  users.forEach((u) => (emails[u.id] = u.email));
  const view = View.findOne({ name: show_view });
  const rendered = await view.viewtemplateObj.renderRows(
    table,
    view.name,
    view.configuration,
    extraArgs,
    hist,
    state
  );
  return div(
    {
      class: ["accordion"],
      id: `top${stateHash}`,
    },
    rendered.map((html, ix) => {
      const row = hist[ix];
      return div(
        { class: "accordion-item" },
        h2(
          { class: "accordion-header", id: `a${stateHash}head${ix}` },
          button(
            {
              class: ["accordion-button", "collapsed"],
              type: "button",
              "data-bs-toggle": "collapse",
              "data-bs-target": `#a${stateHash}tab${ix}`,
              "aria-expanded": "false",
              "aria-controls": `a${stateHash}tab${ix}`,
            },
            date_format
              ? moment(row._time).format(date_format)
              : row._time.toString(),
            " - ",
            emails[row._userid]
          )
        ),
        div(
          {
            class: ["accordion-collapse", "collapse"],
            id: `a${stateHash}tab${ix}`,
            "aria-labelledby": `a${stateHash}head${ix}`,
            "data-bs-parent": `#top${stateHash}`,
          },
          div({ class: ["accordion-body"] }, html)
        )
      );
    })
  );
};

module.exports = {
  name: "History Row Difference",
  display_state_form: false,
  get_state_fields,
  configuration_workflow,
  run,
};
