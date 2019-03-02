class SaverLoader {
    constructor(container, database, view) {
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
                    if (parsed.fileversion == "2.2") {
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
                    database.loadFileSimple(parsed); //naive loading for now
                    //view.switch_view("chord");
                };
            })(f);
            reader.readAsText(f);
        });

        $(container).append(
            "<div id='saverLoaderDiv' class='topMenu' style='width:75px;'>"+
                "<div class='topMenuTitle'><strong>FILE</strong></div>"+
                "<div class='topMenuContainer'>"+
                    "<div id='saveButton'>Save</div>"+
                    "<div id='loadButton'>Open</div>"+
                "</div>"+
            "</div>");
     
        // TODO: add "save as" option
        $('#saveButton').on('click', function(e) {
            e.stopPropagation();
            let file = database.exportFile();
            if (!file)
                return;

            let link = document.createElement('a');
            let blob = new Blob([JSON.stringify(file, null, '\t')]);
            let url = URL.createObjectURL(blob);
            link.href = url;
            link.setAttribute('download', 'mapping.json');
            link.click();
        });

        var self = this;
        $('#loadButton').click(function(e) {
            e.stopPropagation();
            self.fileOpenDialog();
        });
    }

    fileOpenDialog() {
        this.input.trigger("click");
    }

    save() {
        $('#saveButton').trigger("click");
    }
}
