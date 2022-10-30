class SaverLoader {
    constructor(container, graph, view) {
        $(container).append(
            "<div id='saverLoaderDiv' class='topMenu half' style='width:75px;'>"+
                "<div class='topMenuTitle half'><strong>FILE</strong></div>"+
                "<div class='topMenuContainer'>"+
                    "<div id='saveButton'>Save</div>"+
                    "<div id='loadButton'>Open</div>"+
                "</div>"+
            "</div>");
     
        $('#saveButton').on('click', function(e) {
            e.stopPropagation();
            // TODO: allow entry of description, values, views, etc.
            command.send("save", ["", "", [], []]);
        });

        var self = this;
        $('#loadButton').click(async function(e) {
            e.stopPropagation();
            // Show file open dialog and send session json to python server
            const [handle] = await showOpenFilePicker({
                excludeAcceptAllOption: true,
                multiple: false, // TODO: multiple session loading
                types: [{
                    description: 'Mapping session',
                    accept: {'application/json': ['.json']},
                }],
            });
            const data = await handle.getFile();
            let sessionText = await data.text();
            let parsed = tryParseJSON(sessionText);
            command.send("load", [parsed, false]);
        });

        command.unregister("save_session");
        // Called once mappersession has gathered the session json
        command.register("save_session", async function(cmd, args) {
            const handle = await showSaveFilePicker({
                suggestedName: 'mapping.json',
                types: [{
                    description: 'Mapping session',
                    accept: {'application/json': ['.json']},
                }],
            });
            const writable = await handle.createWritable();
            await writable.write(JSON.stringify(args));
            await writable.close();
        });
    }

    save() {
        $('#saveButton').trigger("click");
    }
}
