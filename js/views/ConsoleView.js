//++++++++++++++++++++++++++++++++++++++//
//           Console View Class            //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class ConsoleView extends View {
    constructor(frame, tables, canvas, database, tooltip) {
        super('console', frame, null, canvas, database, tooltip);

        // hide left table
        tables.left.adjust(0, 0, 0, frame.height, 0, 1000);

        // hide right table
        tables.right.adjust(frame.width, 0, 0, frame.height, 0, 1000);

        let self = this;
        this.database.devices.each(function(dev) {
            // remove signal svg
            dev.signals.each(remove_object_svg);
            // remove device svg
            remove_object_svg(dev);
        });

        // remove link svg
        this.database.links.each(remove_object_svg);

        // remove map svg
        this.database.maps.each(remove_object_svg);

        this.escaped = false;

        this.pan = this.tablePan;
        this.zoom = this.tableZoom;

        $('#container').append("<div id='consoleDiv' class='console' "+
                               "style='left:0px; border-right:1px solid gray'>"+
                                   "<span><h2>Console</h2></span>"+
                                   "<div id='consoleHistory'></div>"+
                               "</div>");
        jQuery(function($, undefined) {
            $('#consoleHistory').terminal(function(command) {
                if (command !== '') {
//                    var result = window.eval(command);
//                    if (result != undefined) {
//                        this.echo(String(result));
//                    }
//                    if (command.indexOf(' ') == -1) {
//                        this.echo('unknown command:', command);
//                    }
                    command = command.split(' ');
                    switch (command[0]) {
                        case 'map':
                            if (command.length == 3)
                                $('#container').trigger('map', [command[1], command[2]]);
                            else
                                this.echo('map: wrong number of arguments');
                            break;
                        case 'unmap':
                        case 'rm':
                            if (command.length == 2) {
                                let index = 0;
                                self.database.maps.each(function(map) {
                                    if (++index == command[1]) {
                                        $('#container').trigger('unmap', [map.src.key, map.dst.key]);
                                    }
                                });
                            }
                            else if (command.length == 3)
                                $('#container').trigger('unmap', [command[1], command[2]]);
                            else
                                this.echo('unmap: wrong number of arguments');
                            break;
                        case 'select':
                        case 'sel':
                            let updated = false;
                            if (command.length == 2) {
                                let index = 0;
                                self.database.maps.each(function(map) {
                                    if (++index == command[1])
                                        updated |= select_obj(map);
                                    else if (map.selected) {
                                        map.selected = false;
                                        updated |= true;
                                    }
                                });
                            }
                            else if (command.length == 3) {
                                let key = command[1]+'->'+command[1];
                                self.database.maps.each(function(map) {
                                    if (key == map.key)
                                        updated |= select_obj(map);
                                    else if (map.selected) {
                                        map.selected = false;
                                        updated |= true;
                                    }
                                });
                            }
                            else {
                                this.echo('modify: wrong number of arguments');
                                break;
                            }
                            if (updated) {
                                $('#container').trigger("updateMapProperties");
                                self.updateMaps();
                            }
                            break;
                        case 'modify':
                        case 'mod':
                            let msg = {};
                            let argidx = 0
                            if (/^\d*$/.test(command[1])) {
                                // arg is map index
                                let index = 0;
                                self.database.maps.each(function(map) {
                                    if (++index == parseInt(command[1])) {
                                        msg['src'] = map['src'].key;
                                        msg['dst'] = map['dst'].key;
                                        argidx = 2;
                                    }
                                });
                                if (!argidx)
                                    break;
                            }
                            else if (command.length < 5) {
                                this.echo('unmap: wrong number of arguments');
                                break;
                            }
                            else {
                                msg['src'] = command[1];
                                msg['dst'] = command[2];
                                argidx = 3;
                            }
                            while (argidx < command.length - 1) {
                                msg[command[argidx]] = command[argidx+1];
                                argidx++;
                            }
                            $('#TopMenuWrapper').trigger('setMap', [msg]);
                            break;
                        case 'devices':
                        case 'devs':
                            let index = 0;
                            let echo = this.echo;
                            if (command.length > 1) {
                                let dev = null;
                                let re = new RegExp(command[1]);
                                self.database.devices.each(function(dev) {
                                    ++index;
                                    if (re.test(dev.name))
                                        echo(' '+index+'. <device> '+dev.name);
                                });
                            }
                            else {
                                echo('network includes '+
                                     self.database.devices.size()+' devices:');
                                let index = 0;
                                self.database.devices.each(function(dev) {
                                    echo(' '+(++index)+'. <device> '+dev.name);
                                });
                            }
                            break;
                        case 'signals':
                        case 'sigs':
                            if (command.length > 1) {
                                let dev = null;
                                if (/^\d*$/.test(command[1])) {
                                    // arg is device index
                                    let index = 0;
                                    self.database.devices.each(function(_dev) {
                                        if (++index == parseInt(command[1]))
                                            dev = _dev;
                                    });
                                }
                                else
                                    dev = self.database.devices.find(command[1]);
                                if (dev) {
                                    let echo = this.echo;
                                    echo('device '+dev.name+' has '+
                                         dev.signals.size()+' signals:');
                                    let index = 0;
                                    dev.signals.each(function(sig) {
                                        echo(' '+(++index)+'. <signal> '+sig.key);
                                    });
                                }
                            }
                            else {
                                let echo = this.echo;
                                echo('network includes '+
                                    self.database.devices.size()+' devices. '+
                                     'Choose one to view its signals.');
                                let index = 0;
                                self.database.devices.each(function(dev) {
                                    echo(' '+(++index)+'. <device> '+dev.name);
                                });
                            }
                            break;
                        case 'echo':
                            this.echo(command.shift().join(' '));
                            break;
                        case 'help':
                            this.echo('Available commands:');
                            this.echo('  ls: list all devices in the graph');
                            this.echo('  ls <name>: list all signals belonging to device <name>');
                            this.echo('  ls <index>: list all signals of the device at specified index');
                            this.echo('  map <src> <dst>: create a map from signal <src> to signal <dst>');
                            this.echo('  unmap <src> <dst>: remove map from <src> to <dst> if it exists');
                            this.echo('  unmap <index>: remove the map at the specified index');
                            this.echo('  sel <src> <dst>: select a map');
                            this.echo('  sel <index>: select a map');
                            this.echo('  mod <src> <dst> <properties>: add or modify properties of a map');
                            this.echo('  mod <index> <properties>: add or modify properties of a map');
                            break;
                        default:
                            this.echo('unknown command: '+command[0]);
                            break;

                    }

                }
            }, {
                greetings: '',
                name: 'mapper_console',
                height: '100%',
                width: '100%',
                prompt: 'mapper> ',
                exit: false
            });
        });
//        $('#consoleDiv div').on({
//            keydown: function(e) {
//                e.stopPropagation();
//                if (e.which == 13) { // 'enter' key
//                    console.log(this);
//                            return;
//                    // tokenize by spaces
//                    let command = this.value.split(' ');
//                    if (command[0] != 'map' && command[0] != 'unmap') {
//                        console.log('unknown command', command[0], this);
//                        $('#consoleDiv input').css({'color': 'red'});
//                        return;
//                    }
//                    if (command[0] == 'unmap' && command.length == 2) {
//                        let index = 0;
//                        self.database.maps.each(function(map) {
//                            index++;
//                            if (index == command[1]) {
//                                $('#container').trigger('unmap', [map.src.key, map.dst.key]);
//                            }
//                        });
//                    }
//                    else {
//                        $('#container').trigger(command[0], [command[1], command[2]]);
//                    }
//                    // copy command to history
//                    $('#consoleHistory').append(this.value+"<br/>");
////                    $('textarea').autoResize();
//                    // clear input
//                    this.value = '';
//                    $('#consoleDiv input').css({'color': 'white'});
//                }
//                else if (e.which == 27) { // 'escape' key
//                    // clear input
//                    this.value = '';
//                    $('#consoleDiv input').css({'color': 'white'});
//                }
//                // check for tab key, try autocomplete
//            },
//            click: function(e) { e.stopPropagation(); },
//        });

        $('#container').append("<div id='mapListDiv' class='console' style='left:50%;'>"+
                               "<span><h2>Maps</h2></span>"+
                               "<ol></ol>"+
                               "</div>");

        this.resize(null, 1000);
    }

    resize(newFrame, duration) {
        if (newFrame)
            this.frame = newFrame;

        let self = this;
        this.mapPane.left = 0;
        this.mapPane.width = this.frame.width;
        this.mapPane.height = this.frame.height;
        this.mapPane.cx = this.frame.width * 0.5;
        this.mapPane.cy = this.frame.height * 0.5;

//        $('#consoleDiv').css({'width': this.mapPane.cx,
//                              'height': this.mapPane.height});
//        $('#mapListDiv').css({'width': this.mapPane.cx,
//                              'height': this.mapPane.height,
//                              'left': this.mapPane.cx});

        this.draw();
    }

    draw(duration) {
//        this.drawDevices(duration);
//        this.drawMaps(duration);
    }

    updateMaps() {
        let mapList = $('#mapListDiv ol');
        mapList.empty();
        this.database.maps.each(function(map) {
            let string = "<li";
            if (map.selected)
                string += " style='color:red'"
            string += ">";
            if (map.muted)
                string += "[MUTED] ";
            string += map.src.key+" → "+map.dst.key+"<br/>";
            let keys = Object.keys(map).sort();
            for (var i in keys) {
                let key = keys[i];
                switch (key) {
                    case 'src':
                    case 'dst':
                    case 'key':
                    case 'view':
                    case 'selected':
                    case 'num_inputs':
                    case 'status':
                    case 'version':
                        break;
                    default:
                        string += key+": "+map[key]+"; ";
                }
            }
            mapList.append(string);
        });
    }

    update() {
        let elements;
        switch (arguments.length) {
            case 0:
                elements = ['devices', 'signals', 'maps'];
                break;
            case 1:
                elements = [arguments[0]];
                break;
            default:
                elements = arguments;
                break;
        }
        if (elements.indexOf('maps') >= 0)
            this.updateMaps();
        this.draw(1000);
    }

    cleanup() {
        super.cleanup();

        this.database.devices.each(function(dev) {
            dev.signals.each(function(sig) {
                if (sig.view) {
                    delete sig.view;
                    sig.view = null;
                }
            });
        });

        $('#consoleDiv').remove();
        $('#mapListDiv').remove();
    }
}
