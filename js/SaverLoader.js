class SaverLoader {
    constructor(container, graph, view) {
        this.input = $(document.createElement("input"));
        this.input.attr("type", "file");
        this.input.on('change', function(e) {
            var f = e.target.files[0];

            // reset input value to enable reloading the same file
            this.value = '';

            let reader = new FileReader();
            reader.onload = (function(file) {
                return function(e) {
                    let parsed = tryParseJSON(e.target.result);
                    if (!parsed || !parsed.fileversion || !parsed.mapping) {
                        console.log("error: invalid file");
                        reader.abort();
                        return;
                    }
                    if (parsed.fileversion >= "2.2") {
                        if (!parsed.mapping.maps || !parsed.mapping.maps.length) {
                            console.log("error: no maps in file");
                            reader.abort();
                            return;
                        }
                    }
                    else if (parsed.fileversion == "2.1") {
                        if (   !parsed.mapping.connections
                            || !parsed.mapping.connections.length) {
                            console.log("error: no maps in file");
                            reader.abort();
                            return;
                        }
                    }
                    else {
                        console.log("error: unsupported fileversion",
                                    parsed.fileversion);
                        reader.abort();
                        return;
                    }
                    graph.loadFileSimple(parsed); //naive loading for now
                    //view.switch_view("chord");
                };
            })(f);
            reader.readAsText(f);
        });

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
        $('#loadButton').click(function(e) {
            e.stopPropagation();
            self.fileOpenDialog();
        });

        command.unregister("save_session");
        // Called once mappersession has gathered the session json
        command.register("save_session", async function(cmd, args) {
            console.log(args);
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

    fileOpenDialog() {
        this.input.trigger("click");
    }

    save() {
        $('#saveButton').trigger("click");
    }
}
