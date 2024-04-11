const Field = require("@saltcorn/data/models/field");
const Table = require("@saltcorn/data/models/table");
const Form = require("@saltcorn/data/models/form");
const User = require("@saltcorn/data/models/user");
const View = require("@saltcorn/data/models/view");
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
} = require("@saltcorn/markup/tags");
const { radio_group, checkbox_group } = require("@saltcorn/markup/helpers");

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
        name: "Difference Field",
        form: async (context) => {
          const table = await Table.findOne({ id: context.table_id });
          const field_options = table.fields
            .filter((f) => f.type?.name === "String" || f.type?.name === "HTML")
            .map((f) => f.name);
          return new Form({
            fields: [
              {
                name: "diff_field",
                label: "Difference field",
                sublabel: "String or HTML field to show differences for",
                type: "String",
                attributes: {
                  options: field_options,
                },
              },
            ],
          });
        },
      },
    ],
  });

const run = async (table_id, viewname, { diff_field }, state, extraArgs) => {
  const table = await Table.findOne({ id: table_id });

  const cmpMode = state.diffcmp || "Previous";
  //compare to: Current, Previous, No comparison
  const cmpSel = radio_group({
    options: ["Previous", "Latest", "No comparison"],
    name: "diff_cmp_sel",
    value: cmpMode,
    inline: true,
    onChange: `change_cmp_sel(event)`,
  });
  const id = state[table.pk_name];
  let hist = await table.get_history(id);
  if (!hist || !hist.length) return "No versions recorded";
  hist = hist.reverse();
  const chosen_version = state.version || hist[0]?._version;

  const row = hist.find((h) => chosen_version == h._version);
  const verSelect = select(
    {
      onChange: "change_diff_version(event)",
      class: "form-select form-control",
    },
    hist.map((h) =>
      option(
        { value: h._version, selected: chosen_version == h._version },
        h._time.toString()
      )
    )
  );

  //date and who

  //select version

  //restore to this version

  //show that version
  //show diff
  let diff_html;
  if (cmpMode === "No comparison") diff_html = row[diff_field];
  else {
    const cmpTo =
      cmpMode === "Latest"
        ? hist[0]
        : hist.find((h) => chosen_version - 1 == h._version);
    if (!cmpTo || cmpTo._version == row._version) diff_html = row[diff_field];
    else {
      //const field = table.fields.find((f) => f.name === diff_field);
      const oldH = cmpMode === "Latest" ? row[diff_field] : cmpTo[diff_field];
      const newH = cmpMode === "Latest" ? cmpTo[diff_field] : row[diff_field];
      diff_html = HtmlDiff.default.execute(oldH, newH);
      console.log({ oldH, newH, diff_html });
    }
  }

  return div(
    div({ class: "d-flex" }, p({ class: "me-2" }, "Compare to:"), cmpSel),
    verSelect,
    diff_html,
    script(
      `function change_cmp_sel(e){set_state_field("diffcmp", e.target.value)}
      function change_diff_version(e){set_state_field("version", e.target.value)}`
    )
  );
};

module.exports = {
  name: "History Field Difference",
  display_state_form: false,
  get_state_fields,
  configuration_workflow,
  run,
};
