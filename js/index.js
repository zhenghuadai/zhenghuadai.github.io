$(function app() {
    $('#image000').on('load', function() {
        refresh();
    });
    var canavasedGPU = 0;
    var canavased = 0;
    var lenaGPU = new LenaGPU({width: 512, height: 512});
    // var lenaGPU2 = new LenaGPU({width:640, height:480, gpu: new GPU()});
    (function() {
        let img = $('#image000');
        if (!img[0].complete) return;
        if ($('#image000').width() > 512) {
            $('#display0').children().addClass('stdsize');
            refresh();
        } else if ($('#image000').width() > 0) {
            refresh();
        }
    })()

    function refresh() {
        const canvas = $('#canvasimg0')[0];
        const img = $('#image000');
        let w = img.width();
        let h = img.height();
        canvas.width = img.width();
        canvas.height = img.height();
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img[0], 0, 0, w, h);
        if ((lenaGPU == null) || (lenaGPU.width != w) ||
            (lenaGPU.height != h)) {
            lenaGPU = new LenaGPU({width: w, height: h});
        }
    }

    // file menu
    (function() {
        $('#loadimg').click(function() {
            $('#loadlocal').click();
        });
        $('#loadlocal').on('change', function(ev) {
            let input = ev.target;
            if (input.files && input.files[0]) {
                var reader = new FileReader();

                reader.onload = function(e) {
                    $('#image000').attr('src', e.target.result);
                };

                reader.readAsDataURL(input.files[0]);
            }
        });
        $('#filemenu').menu();
    })();


    // menus for filter and edge
    (function() {
        // append menus
        (function appendmenu() {
            let filters = [
                'grayscale', 'invert', 'red', 'green', 'blue', 'mirror', 'flip',
                'sepia', 'saturation', 'thresholding', 'dct', 'idct'
            ];
            let edges = [
                'canny', 'gaussian', 'gaussian2', 'gaussian3', 'bigGaussian', 'highpass', 'lowpass3',
                'laplacian', 'lowpass5', 'prewittVertical', 'prewittHorizontal',
                'roberts', 'sharpen', 'sobelVertical', 'sobelHorizontal', 'sobelXY',
                'sobelVertical2', 'sobelHorizontal2',
            ];
            function doone(thefilters, themenu) {
                let ula = $('<ul/>');
                thefilters.forEach(function(ele) {
                    ula.append(
                        '<li data-filter=\'' + ele + '\'><div>' + ele +
                        '</div></li>');
                });
                $(themenu).append(ula.children().detach());
            }
            doone(filters, '#filter_menus');
            doone(edges, '#edge_menus');
        })();
        let last_dct_tex = null;
        function dofilterGPU(e, ui) {
            let t = 0;
            let myfilter = ui.item.attr('data-filter');
            if (myfilter) {
                let canvas = $('#canvasGPU')[0];
                //let img = $('#image000')[0];
                let img = $('#canvasimg0')[0];
                let src = img;
                if ($('#AddonToggleButton').is(':checked') && (canavasedGPU)) {
                    src = canvas;
                } 
                if(myfilter == 'idct'){
                    src = last_dct_tex;
                }
                {
                    let c;
                    const t0 = performance.now();
                    c = lenaGPU[myfilter](src, canvas);
                    if( myfilter == 'dct' || myfilter == 'idct'){
                        last_dct_tex = c;
                        c = lenaGPU.present(c, canvas).canvas;
                    }else{
                        c = c.canvas;
                    }
                    if (c) {
                        if (canavasedGPU == 0) {
                            $(c).addClass('gpu');
                            $(c).attr('id', 'canvasgpu');
                        }
                        //$("#display0")[0].appendChild(c);

                        canavasedGPU++;
                    }
                    const t1 = performance.now();
                    t = t1 - t0;
                }
                $('#time').html(t.toFixed(1).toString());
            }
        }
        function dofilterCPU(e, ui) {
            let t = 0;
            console.log($('#AddonToggleButton').is(':checked'));
            let myfilter = ui.item.attr('data-filter');
            if (myfilter) {
                console.log(ui.item.attr('data-filter'));
                let img = $('#image000')[0];
                let canvas = $('#canvasCPU')[0];
                if ($('#AddonToggleButton').is(':checked') && (canavased)) {
                    const t0 = performance.now();
                    LenaJS.redrawCanvas(canvas, LenaJS[myfilter]);
                    const t1 = performance.now();
                    t = t1 - t0;
                } else {
                    const t0 = performance.now();
                    LenaJS.filterImage(canvas, LenaJS[myfilter], img);
                    const t1 = performance.now();
                    t = t1 - t0;
                }
                canavased++;
                $('#time').html(t.toFixed(1).toString());
            }
        }
        function dofilter(e, ui) {
            if ($('#GPUToggleButton').is(':checked')) {
                dofilterGPU(e, ui);
            } else {
                dofilterCPU(e, ui);
            }
        }
        $('#filtermenu').menu({select: dofilter});
        $('#edgemenu').menu({select: dofilter});
    })();

    // view menu
    $('#viewmenu').menu({
        select: function(e, ui) {
            let cmd = ui.item.attr('cmd');
            if (cmd == 0) {
                $('.display1').removeClass('stdsize');
                let w = $('#image000').width(), h = $('#image000').height()
                lenaGPU = new LenaGPU({width: w, height: h, gpu: lenaGPU.gpu});
            } else if (cmd == 1) {
                $('.display1').addClass('stdsize');
                let w = $('#image000').width(), h = $('#image000').height()
                lenaGPU = new LenaGPU({width: w, height: h, gpu: lenaGPU.gpu});
            }
            if (cmd != undefined) {
                let w = $('#image000').width(), h = $('#image000').height()
                let canvas = $('canvas.display1');
                canvas.attr('width', w);
                canvas.attr('height', h);
                refresh();
            }
        }
    });

    // right buttons
    (function() {
        $('#AddonToggleButton').button();
        $('#GPUToggleButton').button();
        $('#timediv').button();
        $('#TestGPU').button();
    })();

    // message box
    function onMessage(txt) {
        $('#messagebox').html(txt);
        if (txt && txt.length > 0) {
            $('#messagebox').addClass('ui-tooltip');
        } else {
            $('#messagebox').removeClass('ui-tooltip');
        }
    };
    $('#meesagebox').button();
    $('#canvasGPU')
        .hover(
            function() {
                onMessage('GPU Canvase');
            },
            function() {
                onMessage('');
            });
    $('#canvasCPU')
        .hover(
            function() {
                onMessage('CPU Canvase');
            },
            function() {
                onMessage('');
            });
    $(document).tooltip();

    // test code
    (function testcs() {
        const generateMatrices = () => {
            const matrices = [[], []];
            for (let y = 0; y < 64; y++) {
                matrices[0].push([])
                matrices[1].push([])
                for (let x = 0; x < 64; x++) {
                    matrices[0][y].push(Math.random())
                    matrices[1][y].push(Math.random())
                }
            }
            return matrices
        };
        const gpu = new (GPUJS || GPU)();
        const multiplyMatrix =
            gpu.createKernel(function(a, b) {
                   let sum = 0;
                   for (let i = 0; i < 64; i++) {
                       sum += a[this.thread.y][i] * b[i][this.thread.x];
                   }
                   return sum;
               })
                .setOutput([64, 64]);
        const matrices = generateMatrices();
        $('#TestGPU').click(function() {
            const out = multiplyMatrix(matrices[0], matrices[1]);
            console.log(out);
        });
    })();
});
