class SaverLoader {
    constructor(container, graph, view) {
        $(container).append(
            "<div id='saverLoaderDiv' class='topMenu half' style='width:225px;'>"+
                "<div id='sessionTitle' class='topMenuTitle half'><strong>SESSION</strong></div>"+
                "<div class='topMenuContainer'>"+
                    "<div style='width:100%;height:30%'>"+
                      "<div id='loadButton' style='width:50%;display:inline-block'>Load</div>"+
                      "<div id='saveButton' style='width:50%;display:inline-block'>Save</div>"+
                    "</div>"+
                    "<div style='padding:0px'>"+
                        "<div id='unloadFile' style='width:50%;display:inline-block'>Unload</div>"+
                        "<p id='fileName' style='width:50%;display:inline-block;float left;padding-left:10px'>No file loaded</p>"+
                    "</div>"+
                "</div>"+
            "</div>");
        $('#unloadFile').on('click', function(e) {
            e.stopPropagation();
            command.send("unload", [$('#fileName').text()]);
            $('#fileName').text("No file loaded");
        });
     
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
            console.log("Loading session: " + data.name);
            $('#fileName').text(data.name.replace(/\.[^/.]+$/, ""));
            let sessionText = await data.text();
            let parsed = tryParseJSON(sessionText);

            command.send("load", [parsed, $('#fileName').text()]);
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
            await writable.write(JSON.stringify(args, null, '    '));
            await writable.close();
        });
    }

    save() {
        $('#saveButton').trigger("click");
    }
}
