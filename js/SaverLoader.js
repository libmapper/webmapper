class SaverLoader {
    constructor(container, graph, view) {
        $(container).append(
            "<div id='saverLoaderDiv' class='topMenu half' style='width:155px;overflow:visible;'>"+
                "<div id='sessionTitle' class='topMenuTitle half'><strong>SESSION</strong></div>"+
                "<div class='topMenuContainer' style='overflow:visible;'>"+
                    "<div>"+
                      "<div id='loadButton' style='width:50%;display:inline-block'>Load</div>"+
                      "<div id='saveButton' style='width:50%;display:inline-block'>Save</div>"+
                    "</div>"+
                    "<div style='overflow:visible;'>"+
                        "<div id='unloadButton' class='disabled' style='width:100%;'>Unload</div>"+
                        "<table id='sessionMenu' class='dropdown-content' style='right:0px;min-width:55px'>"+
                            "<tbody></tbody>"+
                        "</table>"+
                        "<p id='fileName' style='visibility:hidden;'>No file loaded</p>"+
                    "</div>"+
                "</div>"+
            "</div>");

        $('#unloadButton').on('click', function(e) {
            console.log('unloadButton clicked!');
            let menu = $('#sessionMenu');
            if ($(menu).hasClass('show')) {
                $(menu).removeClass('show');
                $(menu).find('td').off('click');
                return;
            }
            $(menu).addClass('show');

            $(menu).find('td').one('click', function(td) {
                $(menu).removeClass('show');
                let session = td.currentTarget.innerText;
                console.log("sending command unload", session);
                command.send("unload", [session]);
            });
            e.stopPropagation();
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

            console.log("sending command: load,", [parsed, $('#fileName').text()]);
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

    updateSessions() {
        console.log("saverLoader.updateSessions()!");
        $('#sessionMenu').empty();
        let active_sessions = graph.active_sessions;
        if (active_sessions.length > 0) {
            for (var i in active_sessions) {
                console.log("  adding session", active_sessions[i], "to the list");
                $('#sessionMenu').append("<tr><td>"+active_sessions[i]+"</td></tr>");
            }
            $('#sessionMenu').removeClass('disabled');
            $('#unloadButton').removeClass('disabled');
            if (active_sessions.length == 1)
                $('#unloadButton').text('Unload ('+active_sessions.length+" tag)");
            else
                $('#unloadButton').text('Unload ('+active_sessions.length+" tags)");
        }
        else {
            $('#sessionMenu').addClass('disabled');
            $('#unloadButton').addClass('disabled');
            $('#unloadButton').text('Unload');
        }
    }
}
