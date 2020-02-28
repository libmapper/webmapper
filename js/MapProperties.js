class MapProperties {
    constructor(container, database, view) {
        this.container = container;
        this.database = database;
        this.view = view;
        this.mapModeCommands = {"Linear": 'linear', "Expression": 'expression' };
        this.mapModes = ["Linear", "Expression"];
        this.mapProtocols = ["UDP", "TCP"];
        this.boundaryIcons = ["none", "right", "left", "mute", "clamp", "wrap"];
        this.cachedProperty = { "key": null, "value": null };

        $(this.container).append(
            "<div' class='topMenu' id='mapPropsContainer' style='width:calc(100% - 605px);'>"+
                "<div id='mapPropsTitle' class='topMenuTitle'><strong>MAP</strong></div>"+
                "<div id='mapPropsDiv' style='position:absolute;left:0px;top:20px;width:100%;height:100%;'></div>"+
            "</div>");

        $('#mapPropsDiv').append(
            "<div class='topMenuContainer' style='width:190px;height:100%;'>"+
                "<div id='protocols' class='signalControl disabled'>Protocol: </div>"+
                "<div id='modes' class='signalControl disabled'>Mode: </div>"+
            "</div>"+
            "<div id='expression' class='signalControl disabled hidden' style='position:absolute;width:calc(100% - 200px);left:200px;top:-20px;height:100%;padding:5px;'>"+
                "<textarea id='expression 'class='expression' style='width:90%;height:100%;resize:none;border-radius:4px;border-color:#FFF'></textarea>"+
                "<div id='curve' class='mode'>Curve</div>"+
            "</div>"+
            "<div class='hidden' id='ranges' style='position:absolute;top:-20px;width:calc(100% - 200px);padding:5px;'></div>");
        
        //Add the mode controls
        for (var m in this.mapModes) {
            $('#modes').append(
                "<div class='mode' id='mode"+this.mapModes[m]+"'>"+this.mapModes[m]+"</div>");
        }

        //Add the protocol controls
        for (var p in this.mapProtocols) {
            $('#protocols').append(
                "<div class='protocol' id='proto"+this.mapProtocols[p]+"'>"+this.mapProtocols[p]+"</div>");
        }

        //Add the range controls
        $('#ranges').append(
            "<div id='srcRange' class='range signalControl disabled'>"+
                "<div style='width:85px'>Src Range:</div>"+
                "<div style='width:calc(100% - 120px)'>"+
                    "<div style='width:24px'></div>"+
                    "<input class='range' id='src_min' style='width:calc(50% - 34px)'></input>"+
                    "<div id='srcRangeSwitch' class='rangeSwitch'></div>"+
                    "<input class='range' id='src_max' style='width:calc(50% - 34px)'></input>"+
                    "<div style='width:24px'></div>"+
                "</div>"+
                "<div id='srcCalibrate' class='calibrate'>Calib</div>"+
            "</div>"+
            "<div id='dstRange' class='range signalControl disabled'>"+
                "<div style='width:85px'>Dest Range:</div>"+
                "<div style='width:calc(100% - 120px)'>"+
                    "<div id='boundary_min' class='boundary boundary_down' type='button'></div>"+
                    "<input class='range' id='dst_min' style='width:calc(50% - 34px)'></input>"+
                    "<div id='dstRangeSwitch' class='rangeSwitch'></div>"+
                    "<input class='range' id='dst_max' style='width:calc(50% - 34px)'></input>"+
                    "<div id='boundary_max' class='boundary boundary_up' type='button'></div>"+
                "</div>"+
                "<div id='muteSwitch' class='mute' type='button'>Mute</div>"+
            "</div>");

        this._addHandlers();
    }

    _addHandlers() {
        var self = this;
        var counter = 0;

        $('#networkSelection').on('change', function(e) {
            command.send("select_network", e.currentTarget.value);
        });

        // The range input handler
        $('#mapPropsContainer').on({
            keydown: function(e) { e.stopPropagation(); },
            keyup: function(e) {
                e.stopPropagation();
                if (e.which == 13 || e.which == 9) { //'enter' or 'tab' key
                    self.setMapProperty($(this).attr('id').split(' ')[0],
                                         this.value);
                }
                else {
                    self.cacheMapProperty($(this).attr('id').split(' ')[0],
                                          this.value);
                }
            },
            click: function(e) { e.stopPropagation(); },
            focusout: function(e) {
                e.stopPropagation();
                self.setMapProperty($(this).attr('id').split(' ')[0],
                                    this.value);
            },
        }, 'input');

        // The expression input handler
        $('#mapPropsContainer').on({
            keydown: function(e) { e.stopPropagation(); },
            keyup: function(e) {
                e.stopPropagation();
                if (e.which == 13) { //'enter' key
                    // check if expression contains a semicolon
                    if (this.value.indexOf(';') == -1 || counter >= 1) {
                        self.setMapProperty($(this).attr('id').split(' ')[0],
                                            this.value);
                        counter = 0;
                    }
                    else {
                        counter += 1;
                        self.cacheMapProperty($(this).attr('id').split(' ')[0],
                                              this.value);
                    }
                }
                else {
                    counter = 0;
                    self.cacheMapProperty($(this).attr('id').split(' ')[0],
                                          this.value);
                }
            },
            click: function(e) { e.stopPropagation(); },
            focusout: function(e) {
                e.stopPropagation();
                self.setMapProperty($(this).attr('id').split(' ')[0],
                                    this.value);
            },
        }, 'textarea');

        //For the mode buttons
        $('#mapPropsContainer').on("click", '.mode', function(e) {
            e.stopPropagation();
            self.setMapProperty("mode", e.currentTarget.innerHTML);
        });

        $('#mapPropsContainer').on("click", '.protocol', function(e) {
            e.stopPropagation();
            self.setMapProperty("protocol", e.currentTarget.innerHTML);
        });

        $('.boundary').on('click', function(e) {
            self.on_boundary(e, self);
        });

        $('.rangeSwitch').click(function(e) {
            e.stopPropagation();
            self.setMapProperty(e.currentTarget.id, null);
        });

        $('.calibrate').click(function(e) {
            e.stopPropagation();
            self.setMapProperty(e.currentTarget.id, null);
        });

        $('#curve').click(function(e) {
            e.stopPropagation();
            self.view.showCurveGenerator(self.getCurveProperties(),
                (expr) => self.setMapProperty("expression", expr));
        });

        $('#muteSwitch').click(function(e) {
            e.stopPropagation();
            self.setMapProperty("muted", null);
        });

        $('body').on('keydown', function(e) {
            if (e.which == 77)
                self.setMapProperty("muted", null);
        });
    }

    // clears and disables the map properties bar
    clearMapProperties() {
        $('.mode').removeClass('sel');
        $('.protocol').removeClass('sel');
        $('#mapPropsContainer .range').val('');
        $('#mapPropsContainer textarea').val('');
        $('.boundary').removeAttr('class').addClass('boundary boundary_none');
        $('.signalControl').children('*').removeClass('disabled');
        $('.signalControl').addClass('disabled');
        $('#mapPropsTitle').addClass('disabled');
        $('.calibrate').removeClass('calibratesel');
        $('#muteSwitch').removeClass('calibratesel');
        $('.range').removeClass('calibratesel');
        $('.expression').removeClass('waiting');
        $('.ranges').children('*').removeClass('waiting');
    }

    selected(map) {
        return map.selected;
    }

    updateMapProperties() {
        this.clearMapProperties();

        var mode = null;
        var muted = null;
        var proto = null;
        var expression = null;
        var src_min = null;
        var src_max = null;
        var dst_min = null;
        var dst_max = null;
        var src_calibrating = null;
        var dst_calibrating = null;
        var dst_bound_min = null;
        var dst_bound_max = null;

        this.database.maps.filter(this.selected).forEach(function(map) {
            if (mode == null)
                mode = map.mode;
            else if (mode != map.mode)
                mode = 'multiple';

            if (muted == null)
                muted = map.muted;
            else if (muted != map.muted)
                muted = 'multiple';

            if (proto == null)
                proto = map.protocol;
            else if (proto != map.protocol)
                proto = 'multiple';

            if (expression == null)
                expression = map.expression;
            else if (expression != map.expression)
                expression = 'multiple expressions';

            if (map.srcs.length == 1) {
                if (src_min == null)
                    src_min = map.srcs[0].min;
                else if (src_min != map.srcs[0].min)
                    src_min = 'multiple';
                if (src_max == null)
                    src_max = map.srcs[0].max;
                else if (src_max != map.srcs[0].max)
                    src_max = 'multiple';
                if (src_calibrating == null)
                    src_calibrating = map.srcs[0].calibrating;
                else if (src_calibrating != map.srcs[0].calibrating)
                    src_calibrating = 'multiple';
            }

            if (dst_min == null)
                dst_min = map.dst.min;
            else if (dst_min != map.dst.min)
                dst_min = 'multiple';
            if (dst_max == null)
                dst_max = map.dst.max;
            else if (dst_max != map.dst.max)
                dst_max = 'multiple';
            if (dst_calibrating == null)
                dst_calibrating = map.dst.calibrating;
            else if (dst_calibrating != map.dst.calibrating)
                dst_calibrating = 'multiple';

            if (dst_bound_min == null)
                dst_bound_min = map.dst.bound_min;
            else if (dst_bound_min != map.dst.bound_min)
                dst_bound_min = 'multiple';
            if (dst_bound_max == null)
                dst_bound_max = map.dst.bound_max;
            else if (dst_bound_max != map.dst.bound_max)
                dst_bound_max = 'multiple';
        });

        if (mode != null) {
            // something has been selected
            $('#mapPropsTitle').removeClass('disabled');
            $('.signalControl').removeClass('disabled');
            $('.signalControl').children('*').removeClass('disabled');
        }

        if (mode != null && mode != 'multiple') {
            // capitalize first letter of mode
            mode = mode.charAt(0).toUpperCase() + mode.slice(1);
            $("#mode"+mode).addClass("sel");
            if (mode == 'Linear') {
                $("#expression").addClass('hidden');
                $("#ranges").removeClass('hidden');
            }
            else {
                $("#ranges").addClass('hidden');
                $("#expression").removeClass('hidden');
            }
        }

        if (muted == true || muted == 'multiple') {
            $('#muteSwitch').addClass('calibratesel');
        }
        else {
            $('#muteSwitch').removeClass('calibratesel');
        }

        if (proto != null && proto != 'multiple') {
            $("#proto"+proto).addClass("sel");
        }

        if (expression != null) {
            $(".expression").removeClass('waiting');
            expression = expression.replace(/;;/, '');
            expression = expression.replace(/;/g, ';\n');
            $(".expression").val(expression);
            if (expression == 'multiple expressions')
                $(".expression").css({'font-style': 'italic'});
            else
                $(".expression").css({'font-style': 'normal'});
        }

        if (src_min != null) {
            $("#src_min").removeClass('waiting');
            if (src_min != 'multiple')
                $("#src_min").val(src_min);
        }
        if (src_max != null) {
            $("#src_max").removeClass('waiting');
            if (src_max != 'multiple')
                $("#src_max").val(src_max);
        }
        if (dst_min != null) {
            $("#dst_min").removeClass('waiting');
            if (dst_min != 'multiple')
                $("#dst_min").val(dst_min);
        }
        if (dst_max != null) {
            $("#dst_max").removeClass('waiting');
            if (dst_max != 'multiple')
                $("#dst_max").val(dst_max);
        }

        if (src_calibrating == true) {
            $("#srcCalibrate").addClass("calibratesel");
            $("#src_min").addClass("calibratesel");
            $("#src_max").addClass("calibratesel");
        }
        else if (src_calibrating == false) {
            $("#srcCalibrate").removeClass("calibratesel");
            $("#src_min").removeClass("calibratesel");
            $("#src_max").removeClass("calibratesel");
        }
        if (dst_calibrating == true) {
            $("#dstCalibrate").addClass("calibratesel");
            $("#dst_min").addClass("calibratesel");
            $("#dst_max").addClass("calibratesel");
        }
        else if (dst_calibrating == false) {
            $("#dstCalibrate").removeClass("calibratesel");
            $("#dst_min").removeClass("calibratesel");
            $("#dst_max").removeClass("calibratesel");
        }

        if (dst_bound_min != null)
            this.set_boundary($("#boundary_min"), dst_bound_min, 0);
        if (dst_bound_max != null)
            this.set_boundary($("#boundary_max"), dst_bound_max, 1);
    }

    getCurveProperties() {
        var curveProps = {
            src_min: null,
            src_max: null,
            dst_min: null,
            dst_max: null,
        };

        this.database.maps.filter(this.selected).forEach(function(map) {
            if (map.srcs.length == 1) {
                if (curveProps.src_min == null)
                    curveProps.src_min = map.srcs[0].min;
                if (curveProps.src_max == null)
                    curveProps.src_max = map.srcs[0].max;
            }
            if (curveProps.dst_min == null)
                curveProps.dst_min = map.dst.min;
            if (curveProps.dst_max == null)
                curveProps.dst_max = map.dst.max;
        });

        return curveProps;
    }

    // object with arguments for the map
    updateMapPropertiesFor(key) {
        // check if map is selected
        var map = this.database.maps.find(key);
        if (this.selected(map))
            this.updateMapProperties();
    }

    cacheMapProperty(key, value) {
        this.cachedProperty.key = key;
        this.cachedProperty.value = value;
    }

    sendCachedProperty() {
        if (!this.cachedProperty.key || !this.cachedProperty.value)
            return;
        this.setMapProperty(this.cachedProperty.key, this.cachedProperty.value);
    }

    setMapProperty(key, value) {
        this.cacheMapProperty();
        let modes = this.mapModeCommands;
        this.database.maps.filter(this.selected).forEach(function(map) {
            if (map[key] && (map[key] == value || map[key] == parseFloat(value)))
                return;

            var msg = {};

            // set the property being modified
            switch (key) {
            case 'mode':
                msg['mode'] = modes[value];
                break;
            case 'protocol':
                msg['protocol'] = value;
                break;
            case 'srcCalibrate':
                msg['src.calibrating'] = !map.srcs[0].calibrating;
                break;
            case 'srcRangeSwitch':
                msg['src.max'] = String(map.srcs[0].min);
                msg['src.min'] = String(map.srcs[0].max);
                $("#src_max").addClass('waiting');
                $("#src_min").addClass('waiting');
                break;
            case 'dstRangeSwitch':
                msg['dst.max'] = String(map.dst.min);
                msg['dst.min'] = String(map.dst.max);
                $("#dst_max").addClass('waiting');
                $("#dst_min").addClass('waiting');
                break;
            case 'muted':
                msg['muted'] = !map['muted'];
                break;
            case 'expression':
                value = value.replace(/\r?\n|\r/g, '');
                if (value == map.expression)
                    return;
                msg['expression'] = value;
                $(".expression").addClass('waiting');
                break;
            case 'src_min':
                if (value == map.srcs[0].min)
                    return;
                msg['src.min'] = value;
                $("#src_min").addClass('waiting');
                break;
            case 'src_max':
                if (value == map.srcs[0].max)
                    return;
                msg['src.max'] = value;
                $("#src_max").addClass('waiting');
                break;
            case 'dst_min':
                if (value == map.dst.min)
                    return;
                msg['dst.min'] = value;
                $("#dst_min").addClass('waiting');
                break;
            case 'dst_max':
                if (value == map.dst.max)
                    return;
                msg['dst.max'] = value;
                $("#dst_max").addClass('waiting');
                break;

            default:
                msg[key] = value;
            }

            // is expression is edited, switch to expression mode
            if (key == 'expression' && map['mode'] != 'expression') {
                msg['mode'] = 'expression';
            }

            // send the command, should receive a /mapped message after.
            command.send("set_map", [map.srcs.map(s => s.signal.key),
                                     map.dst.signal.key, msg]);
        });
    }

    on_load() {
        var self = this;

        //A quick fix for now to get #container out of the way of the load dialogs
        var body = document.getElementsByTagName('body')[0];
        var iframe = document.createElement('iframe');
        iframe.name = 'file_upload';
        iframe.style.visibility = 'hidden';
        body.appendChild(iframe);

        var form = document.createElement('form');
        form.innerHTML = '<input id="file" type="file"                   \
                           name="mapping_json" size="40" accept="json">  \
                          <input type="submit" style="display: none;">   \
                          <input type="button" value="Cancel" id="cancel">';
        form.method = 'POST';
        form.enctype = 'multipart/form-data';
        form.action = '/load';
        form.target = 'file_upload';

        var l = document.createElement('li');
        l.appendChild(form);
        $('#mapPropsContainer').append(l);

        iframe.onload = function() {
//            var t = $(iframe.contentDocument.body).text();
//            if (t.search('Success:') == -1 && t.search('Error:') == -1)
//                return;
            self.notify($(iframe.contentDocument.body).text());
            $(l).remove();
            body.removeChild(iframe);
        };

        $('#cancel', form).click(function() {
            $(l).remove();
            $('#container').removeClass('onLoad');
            body.removeChild(iframe);
        });

        form.firstChild.onchange = function() {

            var fn = document.createElement('input');
            fn.type = 'hidden';
            fn.name = 'filename';
            fn.value = form.firstChild.value;
            form.appendChild(fn);

            // The devices currently in focused
            var devs = self.view.get_focused_devices();

            // Split them into sources and destinations
            var srcdevs = [];
            var dstdevs = [];
            this.database.devices.forEach(function(dev) {
                if (devs.includes(dev.name)) {
                    if (dev.num_outputs)
                        srcdevs.push(dev.name);
                    if (dev.num_inputs)
                        dstdevs.push(dev.name);
                }
            });

            // So that the monitor can see which devices are being looked at
            var srcs = document.createElement('input');
            srcs.type = 'hidden';
            srcs.name = 'sources';
            srcs.value = srcdevs.join();
            form.appendChild(srcs);

            var dsts = document.createElement('input');
            dsts.type = 'hidden';
            dsts.name = 'destinations';
            dsts.value = dstdevs.join();
            form.appendChild(dsts);

            form.submit();
        };
        return false;
    }

    on_boundary(e, self) {
        var boundaryMode = null;
        for (var i in this.boundaryIcons) {
            if ($(e.currentTarget).hasClass("boundary_"+this.boundaryIcons[i])) {
                boundaryMode = this.boundaryIcons[i];
                break;
            }
        }
        if (i >= this.boundaryIcons.length)
            return;

        var is_max = (e.currentTarget.id == 'boundary_max');
        switch (boundaryMode) {
            case 'left':
                if (is_max)
                    boundaryMode = 'wrap'; // fold -> wrap
                else
                    boundaryMode = 'mute'; // none -> mute
                break;
            case 'right':
                if (is_max)
                    boundaryMode = 'mute'; // none -> mute
                else
                    boundaryMode = 'wrap'; // fold -> wrap
                break;
            case 'mute':
                boundaryMode = 'clamp'; // mute -> clamp
                break;
            case 'clamp':
                boundaryMode = 'fold'; // clamp -> fold
                break;
            case 'wrap':
                boundaryMode = 'none'; // wrap -> none
                break;
            default:
                break;
        }
        if (boundaryMode != null)
            self.setMapProperty(is_max ? 'dst.bound_max' : 'dst.bound_min',
                                boundaryMode);
        e.stopPropagation();
    }

    notify(msg) {
        var li = document.createElement('li');
        li.className = 'notification';
        li.innerHTML = msg;
        $('#mapPropsContainer').append(li);
        setTimeout(function() {
            $(li).fadeOut('slow', function() { $(li).remove();});
        }, 5000);
    }

    set_boundary(boundaryElement, value, ismax) {
        for (var i in this.boundaryIcons)
            boundaryElement.removeClass("boundary_"+this.boundaryIcons[i]);

        if (value == 'none') { // special case, icon depends on direction
            if (ismax)
                boundaryElement.addClass('boundary_right');
            else
                boundaryElement.addClass('boundary_left');
        }
        else if (value == 'fold') { // special case, icon depends on direction
            if (ismax)
                boundaryElement.addClass('boundary_left');
            else
                boundaryElement.addClass('boundary_right');
        }
        else if (value != null) {
            boundaryElement.addClass('boundary_'+value);
        }
    }

    /**
     * Updates the save/loading functions based on the view's state
     * currently set up for the list view only
     */
    updateSaveLocation(location) {
        // get the save location
        if (location) {
            window.saveLocation = location;
        }
        else {
            window.saveLocation = '';
        }

        // update the save button's link
        $('#saveButton').attr('href', window.saveLocation);

        // if saving is not ready, disable the save button
        if (window.saveLocation == '') {
            $('#saveButton, #loadButton').addClass('disabled');
        }
        // if saving is ready, enable the save button
        else {
            $('#saveButton, #loadButton').removeClass('disabled');
        }
    }
}
