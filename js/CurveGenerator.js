class CurveGenerator {
    constructor(props, onGenerated) {
        // If curve editor is open, return
        if ($('#curveEditorWindow').length) {
            return;
        }

        let c = props.curve !== null ? props.curve : 0.01;

        let body = $('body');
        $(body).append("<div id='curveEditorWindow' style='position:absolute;left:calc(50% - 30vh);top:25%;background:#494949;width:60vh;height:50vh;display:flex;flex-direction:column;justify-content:center;align-items:center;border-radius:12px;'></div>");
        $('#curveEditorWindow').append("<div id='curveEditor' style='position:relative;display:flex;justify-content:center;align-items:center;'></div");

        var canvas = Raphael($('#curveEditor')[0], '100%', '40vh');
        canvas.setViewBox(0, 0, 120, 120);
        canvas.canvas.id = 'curveSVG';
        canvas.canvas.preserveAspectRatio.baseVal.align = 6;

        // Axes
        let box = canvas.rect(10, 10, 100, 100, 2).attr({'stroke': '#FFF', 'stroke-width': 1});

        // Ranges
        let src_min = 0.0;
        if (Array.isArray(props.src_min))
            src_min = props.src_min[0];
        else if (props.src_min !== 'undefined')
            src_min = props.src_min;
        let src_max = 1.0;
        if (Array.isArray(props.src_max))
            src_max = props.src_max[0];
        else if (props.src_max !== 'undefined')
            src_max = props.src_max;
        let dst_min = 0.0;
        if (Array.isArray(props.dst_min))
            dst_min = props.dst_min[0];
        else if (props.dst_min !== 'undefined')
            dst_min = props.dst_min;
        let dst_max = 1.0;
        if (Array.isArray(props.dst_max))
            dst_max = props.dst_max[0];
        else if (props.dst_max !== 'undefined')
            dst_max = props.dst_max;

        // Axis labels
        canvas.text(7, 10, dst_max.toFixed(1)).attr({'font-size': 5, 'text-anchor': 'end', 'fill': '#FFF'});
        canvas.text(7, 105, dst_min.toFixed(1)).attr({'font-size': 5, 'text-anchor': 'end', 'fill': '#FFF'});
        canvas.text(15, 115, src_min.toFixed(1)).attr({'font-size': 5, 'fill': '#FFF'});
        canvas.text(110, 115, src_max.toFixed(1)).attr({'font-size': 5, 'fill': '#FFF'});

        $('#curveEditor svg').css('overflow', 'visible');
        const reso = 20;
        let points = [];
        for (let i = 0; i <= reso; i++) {
            let x = i / reso;
            let y = get_curve_val(x, 0.0, 1.0, 0.0, 1.0, c);
            x = 10.0 + x * 100.0;
            y = 110.0 - y * 100.0;
            let circ = canvas.circle(x, y, 1).attr({'fill': '#FFF', 'stroke': '#FFF'});
            points.push(circ);
        }

        // Slider
        $('#curveEditor').append(`<input id='curveSlider' type='range' min='-16.0' max='16.0' step='0.1' value='${c}' style='position:absolute;left:100%;-webkit-appearance:slider-vertical;height:80%;width:10%;'>`);
        $('#curveSlider').on('input', function(e) {
            c = $(e.target).val();
            if (c != 0) {
                for (let i = 0; i <= reso; i++) {
                    let x = i / reso;
            		let y = get_curve_val(x, 0.0, 1.0, 0.0, 1.0, c);
            		y = 110.0 - y * 100.0;
                    points[i].attr('cy', y);
                }
                let expr = generate_curve_display(src_min, src_max,
                                                  dst_min, dst_max,
                                                  c);
                $('#curveExprDisplay').empty().append(expr);
                $('#curveGenerate').removeClass('disabled');
            }

        });

        // Generate button
        $('#curveEditorWindow').append("<div id='curveExprDisplay' style='width:90%;text-align:center;color:white;height:3em'>Drag slider to generate a curve</div>"
                                       +"<div style='width:70%'><div id='curveGenerate' class='button sel disabled' style='width:45%;text-align:center;color:white'>Apply to map</div>"
                                       +"<div id='curveEditorClose' class='button sel' style='width:45%;text-align:center;color:white;float:right'>Close editor</div></div>");
        $('#curveGenerate').click(function(e) {
            e.stopPropagation();
            e.preventDefault();
            let expr = generate_curve(src_min, src_max, dst_min, dst_max, c);
            onGenerated(expr, c);
        });
        $('#curveEditorClose').click(function(e) {
            e.stopPropagation();
            e.preventDefault();
            $('#curveEditorWindow').remove();
        });
        $('#curveEditorWindow').on('click', function(e) {
            e.stopPropagation();
        });
        $(body).one('click', function(e) {
            e.stopPropagation();
            $('#curveEditorWindow').remove();
        });
    }
}
