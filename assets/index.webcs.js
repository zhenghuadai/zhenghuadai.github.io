const p = function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(script) {
    const fetchOpts = {};
    if (script.integrity)
      fetchOpts.integrity = script.integrity;
    if (script.referrerpolicy)
      fetchOpts.referrerPolicy = script.referrerpolicy;
    if (script.crossorigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (script.crossorigin === "anonymous")
      fetchOpts.credentials = "omit";
    else
      fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep)
      return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
};
p();
var jqueryUi_min = "";
var highlight_min = "";
var codemirror = "";
var index_html_htmlProxy_index_0 = "";
var matrix = "";
$("#image000").on("load", function() {
  refresh();
});
$(function() {
  let img = $("#image000");
  if (!img[0].complete)
    return;
  if ($("#image000").width() > 512) {
    $("#display0").children().addClass("cssize");
    refresh();
  } else if ($("#image000").width() > 0) {
    refresh();
  }
});
function refresh() {
  const canvas = $("#canvasimg0")[0];
  const img = $("#image000");
  let w = img.width();
  let h = img.height();
  canvas.width = img.width();
  canvas.height = img.height();
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img[0], 0, 0, w, h);
}
(function() {
  $("#loadimg").click(function() {
    $("#loadlocal").click();
  });
  $("#loadlocal").on("change", function(ev) {
    let input = ev.target;
    if (input.files && input.files[0]) {
      var reader = new FileReader();
      reader.onload = function(e) {
        $("#image000").attr("src", e.target.result);
      };
      reader.readAsDataURL(input.files[0]);
    }
  });
  $("#filemenu").menu();
})();
$("#viewmenu").menu({
  select: function(e, ui) {
    ui.item.attr("cmd");
  }
});
$(function() {
  $("#AddonToggleButton").button();
  $("#GPUToggleButton").button();
  $("#timediv").button();
  $("#TestGPU").button();
});
function showMessage(txt) {
  $("#messagebox").html(txt);
  $("#messagebox").show();
  if (txt && txt.length > 0) {
    $("#messagebox").removeClass("minimize");
    $("#messagebox").addClass("ui-tooltip");
  } else {
    $("#messagebox").removeClass("ui-tooltip");
  }
  setTimeout(function() {
    $("#messagebox").addClass("minimize");
  }, 5e3);
}
$("#messagebox").hover(function() {
  $("#messagebox").removeClass("minimize");
}, function() {
  setTimeout(function() {
    $("#messagebox").addClass("minimize");
  }, 5e3);
});
$("#meesagebox").button();
let App = {};
App.showMessage = showMessage;
function _isString(arg) {
  return typeof arg === "string";
}
function _isArray(arg) {
  return Array.isArray(arg) || ArrayBuffer.isView(arg) && !(arg instanceof DataView);
}
function _align16b(n) {
  return n + 15 & 4294967280;
}
class CSKernel {
  constructor(webCS2, prog, settings = {}) {
    this.kernel = prog;
    this.local_size = settings.local_size || [32, 1, 1];
    this.groups = settings.groups;
    this.webCS = webCS2;
    this.vids = null;
    this.computePipeline = null;
    this.settings = settings;
  }
  async run() {
    this.commandEncoder = this.webCS.gpuDevice.createCommandEncoder();
    this.__createPipeline();
    await this.__updateArgments(arguments);
    if (this.groups == null) {
      this.groups = [
        Math.floor(this.webCS.canvas.width / this.local_size[0]),
        Math.floor(this.webCS.canvas.height / this.local_size[1]),
        1
      ];
    }
    const passEncoder = this.commandEncoder.beginComputePass();
    passEncoder.setPipeline(this.computePipeline);
    if (this.bindGroup) {
      passEncoder.setBindGroup(0, this.bindGroup);
    }
    if (this.__getNumberOfUniform() > 0) {
      passEncoder.setBindGroup(1, this.uniformBindGroup);
    }
    passEncoder.dispatchWorkgroups(this.groups[0], this.groups[1], this.groups[2]);
    passEncoder.end();
    const gpuCommands = this.commandEncoder.finish();
    this.webCS.gpuDevice.queue.submit([gpuCommands]);
    await this.webCS.gpuDevice.queue.onSubmittedWorkDone();
  }
  setUniform(name, ...rest) {
    let device = this.webCS.gpuDevice;
    let values = rest;
    let mytype = this.settings.uniform[name].type;
    const slot = this.settings.uniform[name].index;
    let uniformValue = null;
    let dataType = this.__sfmt2datatype(mytype);
    if (dataType == "u32") {
      uniformValue = new Uint32Array(values);
    } else if (dataType == "i32") {
      uniformValue = new Int32Array(values);
    } else if (dataType == "f32") {
      uniformValue = new Float32Array(values);
    } else if (dataType == "f16") {
      uniformValue = new Uint16Array(values);
    } else {
      uniformValue = new Uint32Array(values);
    }
    let bufferSizeInBytes = _align16b(4 * values.length);
    if (this.uniformVids[slot] == null) {
      this.uniformVids[slot] = device.createBuffer({
        mappedAtCreation: true,
        size: bufferSizeInBytes,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      const hostAccessBuffer = this.uniformVids[slot].getMappedRange();
      new uniformValue.constructor(hostAccessBuffer).set(uniformValue);
      this.uniformVids[slot].unmap();
    } else {
      device.queue.writeBuffer(this.uniformVids[slot], 0, uniformValue.buffer, uniformValue.byteOffset, uniformValue.byteLength);
    }
    return this;
  }
  getTexture(name) {
    return this.getBuffer(name);
  }
  getBuffer(name) {
    if (typeof name === "string") {
      let findIndex = function(o, value) {
        return o.indexOf(value);
      };
      let index = findIndex(this.settings.params.all, name);
      return this.vids[index];
    } else if (typeof name === "number") {
      return this.vids[name];
    }
  }
  async getData(name, dstarray) {
    let vid = this.getBuffer(name);
    return await this.webCS.getData(vid, dstarray);
  }
  setGroups(x, y = 1, z = 1) {
    this.groups = [x, y, z];
    return this;
  }
  __getNumberOfUniform() {
    return this.settings.uniform ? Object.keys(this.settings.uniform).length : 0;
  }
  __createPipeline() {
    if (this.computePipeline != null)
      return;
    this.__createLayout();
    let device = this.webCS.gpuDevice;
    let layouts = [];
    let bindGroupLayout = this.bindGroupLayout;
    let uniformBindGroupLayout = this.uniformBindGroupLayout;
    if (bindGroupLayout) {
      layouts.push(bindGroupLayout);
    }
    if (uniformBindGroupLayout) {
      layouts.push(uniformBindGroupLayout);
    }
    this.computePipeline = device.createComputePipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: layouts }),
      compute: { module: this.kernel, entryPoint: "main" }
    });
  }
  __createLayout() {
    let device = this.webCS.gpuDevice;
    let entries = [];
    for (var i = 0; i < this.settings.params.all.length; i++) {
      let argName = this.settings.params.all[i];
      let param = this.settings.params[argName];
      let argType = param.type;
      let argIndex = param.index;
      if (argType.dim == 1) {
        entries.push({ binding: argIndex, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } });
      } else if (argType.dim == 2) {
        if (param.rwmode == "w") {
          let sfmt = this.__str2sfmt(argType.type);
          entries.push({
            binding: argIndex,
            visibility: GPUShaderStage.COMPUTE,
            storageTexture: {
              viewDimension: "2d",
              access: "write-only",
              format: sfmt
            }
          });
        } else {
          entries.push({
            binding: argIndex,
            visibility: GPUShaderStage.COMPUTE,
            texture: {
              viewDimension: "2d",
              sampleType: "unfilterable-float"
            }
          });
        }
      } else {
        entries.push({ binding: argIndex, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } });
      }
    }
    if (entries.length > 0) {
      this.bindGroupLayout = device.createBindGroupLayout({ entries });
    }
    let uniform_entries = [];
    for (const [key, uniform] of Object.entries(this.settings.uniform)) {
      uniform_entries.push({ binding: uniform.index, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } });
    }
    if (uniform_entries.length > 0) {
      this.uniformBindGroupLayout = device.createBindGroupLayout({ entries: uniform_entries });
    }
  }
  async __updateArg(i, arg) {
    let isBuffer = function(argType2) {
      return argType2.dim == 1;
    };
    let isTexture = function(argType2) {
      return argType2.dim == 2;
    };
    let device = this.webCS.gpuDevice;
    let argName = this.settings.params.all[i];
    let argType = this.settings.params[argName].type;
    if (isBuffer(argType)) {
      let createBuffer2 = function(bytes) {
        let gpuBuffer = device.createBuffer({
          mappedAtCreation: true,
          size: bytes,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        });
        return gpuBuffer;
      };
      var createBuffer = createBuffer2;
      let w = this.settings.groups[0] * this.settings.local_size[0];
      let h = this.settings.groups[1] * this.settings.local_size[1];
      if (arg == null) {
        if (this.vids[i] == null) {
          let size = w * h * (argType.type == "double" ? 8 : 4);
          let gpuBuffer = createBuffer2(size);
          gpuBuffer.getMappedRange();
          gpuBuffer.unmap();
          this.vids[i] = gpuBuffer;
        }
      } else if (arg instanceof GPUBuffer) {
        this.vids[i] = arg;
        arg.unmap();
      } else if (_isArray(arg)) {
        if (this.vids[i] != null) {
          let vid_size = this.vids[i].size;
          if (vid_size < arg.byteLength) {
            this.vids[i] = createBuffer2(arg.byteLength);
            const hostAccessBuffer = this.vids[i].getMappedRange();
            new Float32Array(hostAccessBuffer).set(arg);
            this.vids[i].unmap();
          } else {
            device.queue.writeBuffer(this.vids[i], 0, arg, 0);
          }
        } else {
          this.vids[i] = createBuffer2(arg.byteLength);
          const hostAccessBuffer = this.vids[i].getMappedRange();
          new Float32Array(hostAccessBuffer).set(arg);
          this.vids[i].unmap();
        }
      }
    } else if (isTexture(argType)) {
      let createTexture2 = function(w, h, sfmt2) {
        w = w || this.webCS.canvas.width;
        h = h || this.webCS.canvas.height;
        sfmt2 = sfmt2 || "rgba8unorm";
        let tex = device.createTexture({
          size: {
            width: w,
            height: h
          },
          format: sfmt2,
          usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
        });
        tex.size = [w, h, 4];
        return tex;
      };
      var createTexture = createTexture2;
      let sfmt = this.__str2sfmt(argType.type);
      this.__sfmt2fmt(sfmt);
      this.__sfmt2datatype(sfmt);
      if (arg == null) {
        if (this.vids[i] == null) {
          this.vids[i] = createTexture2.apply(this);
        }
      } else if (arg instanceof GPUTexture) {
        this.vids[i] = arg;
      } else if (arg instanceof HTMLCanvasElement || arg instanceof HTMLImageElement) {
        if (this.vids[i] == null) {
          this.vids[i] = createTexture2.apply(this);
        }
        if (this.vids[i].width != null && this.vids[i].height != null && (this.vids[i].width < arg.width || this.vids[i].height < arg.height)) {
          this.vids[i] = createTexture2.apply(this, [arg.width, arg.height, sfmt]);
        }
        let tex = this.vids[i];
        arg.width;
        arg.height;
        let imageBitmap = await createImageBitmap(arg);
        device.queue.copyExternalImageToTexture({ source: imageBitmap }, { texture: tex }, [imageBitmap.width, imageBitmap.height]);
      }
    } else
      ;
  }
  __sfmt2datatype(fmt) {
    return this.webCS.SFmt2DataType[fmt] || "f32";
  }
  __sfmt2fmt(fmt) {
    return this.webCS.SFmt2Fmt[fmt] || "rgba8unorm";
  }
  __str2sfmt(str) {
    return this.webCS.Str2SFmt[str] || "rgba8unorm";
  }
  async __updateArgments(args) {
    let nargs = this.settings.params.all.length;
    this.vids = this.vids || Array.from({ length: nargs }, (v, i2) => null);
    if (args.lenght != nargs && args.length != nargs + 1 && args.length != nargs + 3 && args.length != nargs + 4)
      ;
    for (var i = 0; i < this.vids.length; i++) {
      await this.__updateArg(i, args[i]);
    }
    if (args.length == nargs + 3 || args.length == nargs + 4) {
      this.groups[0] = args[nargs];
      this.groups[1] = args[nargs + 1];
      this.groups[2] = args[nargs + 2];
    }
    let nUniform = Object.keys(this.settings.uniform).length;
    if (Object.keys(this.settings.uniform).length > 0) {
      this.uniformVids = this.uniformVids || Array.from({ length: nUniform }, (v, i2) => null);
      if (args.length == nargs + 1 || args.length == nargs + 4) {
        let uniforms = args[args.length - 1];
        for (var uniform_key in uniforms) {
          let uniform_args = [uniform_key].concat(uniforms[uniform_key]);
          this.setUniform.apply(this, uniform_args);
        }
      }
    }
    this.__createBindGroup();
    this.__createUniformBindGroup();
  }
  __createBindGroup() {
    let device = this.webCS.gpuDevice;
    let bindGroupLayout = this.bindGroupLayout;
    let entries = [];
    for (var i = 0; i < this.settings.params.all.length; i++) {
      let buffer = this.vids[i];
      if (buffer instanceof GPUTexture) {
        entries.push({ binding: i, resource: buffer.createView() });
      } else {
        entries.push({ binding: i, resource: { buffer } });
      }
    }
    if (entries.length > 0) {
      const bindGroup = device.createBindGroup({ layout: bindGroupLayout, entries });
      this.bindGroup = bindGroup;
    }
  }
  __createUniformBindGroup() {
    let device = this.webCS.gpuDevice;
    let bindGroupLayout = this.uniformBindGroupLayout;
    let entries = [];
    let nUniform = Object.keys(this.settings.uniform).length;
    for (var i = 0; i < nUniform; i++) {
      let buffer = this.uniformVids[i];
      entries.push({ binding: i, resource: { buffer } });
    }
    if (entries.length > 0) {
      const bindGroup = device.createBindGroup({ layout: bindGroupLayout, entries });
      this.uniformBindGroup = bindGroup;
    }
  }
}
class WebCS {
  constructor(adapter, device, settings = {}) {
    this.canvas = settings.canvas || document.createElement("canvas");
    if (settings.canvas == null) {
      let canvas = document.createElement("canvas");
      canvas.width = settings.width || 640;
      canvas.height = settings.height || 480;
      this.canvas = canvas;
    } else {
      this.canvas = settings.canvas;
    }
    this.adapter = adapter;
    this.gpuDevice = device;
    this.SFmt2DataType = {};
    this.SFmt2Fmt = {};
    this.Str2SFmt = {};
    this.presentSettings = { initialized: false };
    this.__setFmt();
  }
  static async create(settings = {}) {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      console.log("Failed to get GPU adapter.");
      return;
    }
    const device = await adapter.requestDevice();
    return new WebCS(adapter, device, settings);
  }
  createShaderFromString(source, settings = {}) {
    const shaderModule = this.gpuDevice.createShaderModule({ code: source });
    settings.commandEncoder = this.gpuDevice.createCommandEncoder();
    this.commandEncoder = settings.commandEncoder;
    let webCS2 = this;
    return new CSKernel(webCS2, shaderModule, settings);
  }
  createShaderFromFunction(func, settings = {}) {
    let csmain_str = func();
    let layout_str = "";
    let comments = /(\/\/.*)|(\/\*[\s\S]*?\*\/)/g;
    let csmain_nocomments = csmain_str.replace(comments, "");
    let global_str = "";
    let global_func_str = (this.glsl_functions || "") + "\n" + (settings.glsl_functions || "");
    var isWhite = function(ch) {
      return ch == " " || ch == "	" || ch == "\n";
    };
    var isSeperator = function(ch) {
      return ch == " " || ch == "	" || ch == "\n" || ch == "=";
    };
    {
      let re_shared = /shared\s+[^;]+;/g;
      let matches = [...csmain_nocomments.matchAll(re_shared)];
      for (let match of matches) {
        global_str = global_str + match[0];
      }
      csmain_nocomments = csmain_nocomments.replace(re_shared, "");
    }
    {
      let func_si = csmain_nocomments.indexOf("function");
      if (func_si > 0) {
        let indexOfendf2 = function(str, si) {
          let l = str.length;
          let ending = 0;
          for (let iii = si; iii < l; iii++) {
            if (str[iii] == "{")
              ending = ending + 1;
            if (str[iii] == "}") {
              ending = ending - 1;
              if (ending == 0) {
                return iii + 1;
              }
            }
          }
          return null;
        };
        var indexOfendf = indexOfendf2;
        while (func_si > 0) {
          if (isWhite(csmain_nocomments[func_si + 8])) {
            let funcEndI = indexOfendf2(csmain_nocomments, func_si + 8);
            global_func_str = global_func_str + "\nfn " + csmain_nocomments.substring(func_si + 8, funcEndI);
            csmain_nocomments = csmain_nocomments.substring(0, func_si) + csmain_nocomments.substring(funcEndI);
            func_si = csmain_nocomments.indexOf("function");
          } else {
            func_si = csmain_nocomments.indexOf("function", func_si + 8);
          }
        }
      }
    }
    {
      let func_si = csmain_nocomments.indexOf("const");
      if (func_si > 0) {
        while (func_si > 0) {
          if (isWhite(csmain_nocomments[func_si + 5])) {
            let funcEndI = csmain_nocomments.indexOf(";", func_si + 5) + 1;
            let myvar = "const " + csmain_nocomments.substring(func_si + 5, funcEndI);
            global_func_str = global_func_str + "\n" + myvar;
            csmain_nocomments = csmain_nocomments.substring(0, func_si) + csmain_nocomments.substring(funcEndI);
            func_si = csmain_nocomments.indexOf("const");
          } else {
            func_si = csmain_nocomments.indexOf("const", func_si + 5);
          }
        }
      }
    }
    {
      let func_si = csmain_nocomments.indexOf("var<workgroup>");
      if (func_si > 0) {
        while (func_si > 0) {
          let funcEndI = csmain_nocomments.indexOf(";", func_si + 14) + 1;
          let myvar = csmain_nocomments.substring(func_si, funcEndI);
          global_func_str = global_func_str + "\n" + myvar;
          csmain_nocomments = csmain_nocomments.substring(0, func_si) + csmain_nocomments.substring(funcEndI);
          func_si = csmain_nocomments.indexOf("var<workgroup>");
        }
      }
    }
    {
      let func_str = func.toString();
      let startI = func_str.indexOf("(");
      let endI = func_str.indexOf(")");
      let param_str = func_str.substring(startI + 1, endI).replace(/\s/g, "");
      let params = param_str.split(",");
      if (settings.params == null) {
        settings.params = { all: params };
      } else {
        settings.params.all = params;
      }
      {
        let that = this;
        params.forEach(function(ele, idx) {
          if (settings.params[ele] == null) {
            settings.params[ele] = { index: idx, type: that.__parsetype("buffer") };
          } else {
            settings.params[ele].index = idx;
          }
        });
      }
      {
        params.forEach(function(ele, idx) {
          let myreg = new RegExp("var[\\s]+" + ele + "[\\s]*:[\\s]*([^;]+)[\\s]*;");
          let mymatch = csmain_nocomments.match(myreg);
          if (mymatch) {
            csmain_nocomments = csmain_nocomments.replace(myreg, "");
            settings.params[ele].type.final_type = mymatch[1];
          }
        });
      }
      {
        let params_tex = Object.keys(settings.params).filter((key) => settings.params[key].type != null && settings.params[key].type.dim === 2);
        if (params_tex.length == 0)
          ;
        else {
          {
            for (let texname of params_tex) {
              let texreader2 = new RegExp(["(", texname, ")", "\\s*\\[([^\\[\\]]+)\\]\\s*\\[([^\\[\\]]+)\\]"].join(""), "g");
              let texwriter2 = new RegExp(["(", texname, ")", "\\s*\\[([^\\[\\]]+)\\]\\s*\\[([^\\[\\]]+)\\]\\s=([^;]+);"].join(""), "g");
              let texreader = new RegExp(["(", texname, ")", "\\s*\\[([^\\[\\]]+)\\]"].join(""), "g");
              let texwriter = new RegExp(["(", texname, ")", "\\s*\\[([^\\[\\]]+)\\]\\s*=([^;]+);"].join(""), "g");
              csmain_nocomments = csmain_nocomments.replace(texwriter2, "textureStore($1,vec2<i32>(i32($3),i32($2)), $4);");
              csmain_nocomments = csmain_nocomments.replace(texwriter, "textureStore($1,vec2<i32>($2), $3);");
              csmain_nocomments = csmain_nocomments.replace(texreader2, "textureLoad($1,vec2<i32>(i32($3),i32($2)), 0);");
              csmain_nocomments = csmain_nocomments.replace(texreader, "textureLoad($1,vec2<i32>($2), 0);");
            }
          }
          {
            let imgst_re = /textureStore\s*\(\s*([^,]+),/g;
            let matches = [...csmain_nocomments.matchAll(imgst_re)];
            for (let match of matches) {
              var vname = match[1].trim();
              if (settings.params[vname] == null)
                ;
              else {
                settings.params[vname].rwmode = "w";
              }
            }
          }
        }
        for (let paramname of settings.params.all) {
          let memaccessor = new RegExp(["[\\W](", paramname, ")", "\\s*\\["].join(""), "g");
          csmain_nocomments = csmain_nocomments.replace(memaccessor, " $1.data[");
        }
      }
      for (var pi = 0; pi < params.length; pi++) {
        let param_name = params[pi];
        let param_type = settings.params[param_name].type;
        if (param_type.dim == 1) {
          let num_type = param_type.type;
          let final_type = param_type.final_type || `array<${num_type}>`;
          layout_str = layout_str + ` struct struct_${param_name}{ data: ${final_type}} ;
@group(0) @binding(${pi}) var<storage, read_write> ${param_name} : struct_${param_name};
`;
        } else if (param_type.dim == 2) {
          let pix_type = this.__str2sfmt(param_type);
          let value_type = this.__sfmt2datatype(pix_type);
          let rwmode = settings.params[param_name].rwmode == "w" ? "writeonly" : "readonly";
          let attr = settings.params[param_name].attr || "";
          if (attr.indexOf("readonly") == -1 && attr.indexOf("writeonly") == -1) {
            attr = attr + " " + rwmode;
          }
          if (attr.indexOf("readonly") > 0) {
            let final_type = param_type.final_type || `texture_2d<${value_type}>`;
            layout_str = layout_str + `@group(0) @binding(${pi}) var ${param_name} : ${final_type};
`;
          } else {
            let final_type = param_type.final_type || `texture_storage_2d<${pix_type}, write>`;
            layout_str = layout_str + `@group(0) @binding(${pi}) var ${param_name} : ${final_type};
`;
          }
        } else
          ;
      }
    }
    let unform_str = "";
    {
      if (!settings.hasOwnProperty("uniform")) {
        settings.uniform = {};
      }
      let re = /this\.uniform\.([a-zA-Z0-9_-]{1,})\.([a-zA-Z0-9_-]{1,})/g;
      let re2 = /this\.uniform\.([a-zA-Z0-9_-]{1,})([^\.a-zA-Z0-9_-])+/g;
      let matches = [...csmain_nocomments.matchAll(re)];
      let matches2 = [...csmain_nocomments.matchAll(re2)];
      var indexOfSeperator = function(s, startIndex) {
        let si = startIndex;
        while (!isSeperator(s[si]))
          si++;
        return si;
      };
      var indexOfNonSpace = function(s, startIndex) {
        let si = startIndex;
        while (isWhite(s[si]))
          si++;
        return si;
      };
      var types = {
        "u32": "vec4<u32>",
        "f32": "vec4<f32>",
        "i32": "vec4<i32>",
        "f64": "vec4<f64>",
        "vec4<i32>": "vec4<i32>",
        "vec4<u32>": "vec4<u32>",
        "vec4<f32>": "vec4<f32>",
        "vec4<f64>": "vec4<f64>"
      };
      let updateOneMatch = function(match) {
        let lineStartI = 0;
        lineStartI = Math.max(lineStartI, csmain_nocomments.lastIndexOf(";", match.index));
        lineStartI = Math.max(lineStartI, csmain_nocomments.lastIndexOf("}", match.index));
        lineStartI = Math.max(lineStartI, csmain_nocomments.lastIndexOf("{", match.index));
        lineStartI = lineStartI + 1;
        let colonIndex = csmain_nocomments.lastIndexOf(":", match.index);
        if (colonIndex > lineStartI) {
          let type_si = indexOfNonSpace(csmain_nocomments, colonIndex + 1);
          let type_ei = indexOfSeperator(csmain_nocomments, type_si);
          let type_str = csmain_nocomments.substring(type_si, type_ei);
          let mytype = types[type_str] || type_str;
          settings.uniform[vname]["type"] = mytype;
        }
      };
      for (let match of matches) {
        var vname = match[1];
        if (settings.uniform[vname] == null) {
          settings.uniform[vname] = { type: null, fields: {} };
        }
        settings.uniform[vname][match[2]] = 1;
        {
          updateOneMatch(match);
        }
      }
      for (let match of matches2) {
        var vname = match[1];
        if (settings.uniform[vname] == null) {
          settings.uniform[vname] = { type: null, fields: {} };
        }
        {
          updateOneMatch(match);
        }
      }
      let pi2 = 0;
      for (let uniform in settings.uniform) {
        let mytype = settings.uniform[uniform].type || "vec4<u32>";
        settings.uniform[uniform].index = pi2;
        let my_uniform_str = `
                struct struct_${uniform} {data:${mytype}};
                @group(1) @binding(${pi2}) var<uniform> ${uniform} : struct_${uniform};`;
        unform_str = unform_str + my_uniform_str;
      }
      {
        for (let uniform in settings.uniform) {
          let memaccessor = new RegExp(["this.uniform.(", uniform, ")"].join(""), "g");
          csmain_nocomments = csmain_nocomments.replace(memaccessor, "$1.data");
        }
      }
    }
    let local_size = settings.local_size || [8, 8, 1];
    let source = `
        ${layout_str} 
        ${unform_str}
        ${global_str}
        const LOCAL_SIZE_X:u32 = ${local_size[0]}u;
        const LOCAL_SIZE_Y:u32 = ${local_size[1]}u;
        const LOCAL_SIZE_Z:u32 = ${local_size[2]}u;
        var<private> g_num_workgroups:vec3<u32>;
        var<private> g_workgroup_id:vec3<u32>;
        ${global_func_str}
        fn csmain(thread: vec3<u32>, localthread:vec3<u32>, workgroup_id:vec3<u32>){
            ${csmain_nocomments}
        }
        @compute @workgroup_size(${local_size[0]}, ${local_size[1]}, ${local_size[2]})

        fn main(@builtin(global_invocation_id) thread: vec3<u32>, @builtin(local_invocation_id) localthread: vec3<u32>, @builtin(workgroup_id) block: vec3<u32>, @builtin(num_workgroups) wgs:vec3<u32>) {
            g_num_workgroups = wgs;
            g_workgroup_id = block;
            csmain(thread, localthread, block);
        }
        `;
    return this.createShaderFromString(source, settings);
  }
  __parsetype(type) {
    type = type.replace(/\s*/g, "");
    let bi = -1;
    let t = "f32";
    let dim = 1;
    if (type == "buffer") {
      t = "f32";
      dim = 1;
    } else if (type == "texture") {
      t = "rgba8unorm";
      dim = 2;
    } else if ((bi = type.indexOf("[][]")) >= 0) {
      t = bi == 0 ? "rgba8unorm" : type.substring(0, bi).toLowerCase();
      dim = 2;
    } else if ((bi = type.indexOf("[]")) >= 0) {
      t = bi == 0 ? "f32" : type.substring(0, bi).toLowerCase();
      if (["f32", "u32", "i32"].includes(t))
        ;
      else if (t == "float") {
        t = "f32";
      } else {
        throw "type is not supported : " + t;
      }
      dim = 1;
    } else
      ;
    return { "type": t, "dim": dim };
  }
  createShader(source, settings = {}) {
    {
      if (settings.params != null) {
        for (let key in settings.params) {
          let v = settings.params[key];
          if (_isString(v)) {
            settings.params[key] = { type: this.__parsetype(v) };
          }
        }
      }
    }
    if (typeof source === "string") {
      return this.createShaderFromString(source, settings);
    } else {
      return this.createShaderFromFunction(source, settings);
    }
  }
  addFunctions(func) {
    this.glsl_functions = this.glsl_functions || "";
    this.glsl_functions += func;
  }
  async present(tex) {
    const canvas = this.canvas;
    const context = this.canvas.getContext("webgpu");
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    let device = this.gpuDevice;
    if (this.presentSettings.initialized == false) {
      const presentationSize = [
        canvas.width,
        canvas.height
      ];
      context.configure({
        device,
        format: presentationFormat,
        size: presentationSize
      });
      const fullscreenTexturedQuadWGSL = `
        @group(0) @binding(0) var mSampler : sampler;
        @group(0) @binding(1) var mTexture : texture_2d<f32>;

        struct VertexOutput {
            @builtin(position) Position : vec4<f32>,
            @location(0) fragUV : vec2<f32>
        };

        @vertex
        fn vert_main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
            var pos = array<vec2<f32>, 4>(
                vec2<f32>( 1.0,  1.0),
                vec2<f32>( 1.0, -1.0),
                vec2<f32>(-1.0,  1.0),
                vec2<f32>(-1.0,  -1.0));

            var uv = array<vec2<f32>, 4>(
                vec2<f32>(1.0, 0.0),
                vec2<f32>(1.0, 1.0),
                vec2<f32>(0.0, 0.0),
                vec2<f32>(0.0, 1.0));

            var output : VertexOutput;
            output.Position = vec4<f32>(pos[VertexIndex], 0.0, 1.0);
            output.fragUV = uv[VertexIndex];
            return output;
        }

        @fragment
        fn frag_main(@location(0) fragUV : vec2<f32>) -> @location(0) vec4<f32> {
            var color:vec4<f32> = textureSample(mTexture, mSampler, fragUV);
            return color;
        }
        `;
      const bindGroupLayout = device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} }
        ]
      });
      const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });
      const fullscreenQuadPipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
          module: device.createShaderModule({
            code: fullscreenTexturedQuadWGSL
          }),
          entryPoint: "vert_main"
        },
        fragment: {
          module: device.createShaderModule({
            code: fullscreenTexturedQuadWGSL
          }),
          entryPoint: "frag_main",
          targets: [
            {
              format: presentationFormat
            }
          ]
        },
        primitive: {
          topology: "triangle-strip"
        }
      });
      const sampler = device.createSampler({
        magFilter: "linear",
        minFilter: "linear"
      });
      this.presentSettings.sampler = sampler;
      this.presentSettings.fullscreenQuadPipeline = fullscreenQuadPipeline;
      this.presentSettings.initialized = true;
    }
    let commandEncoder = device.createCommandEncoder();
    let _sampler = this.presentSettings.sampler;
    let _fullscreenQuadPipeline = this.presentSettings.fullscreenQuadPipeline;
    const renderBindGroup = device.createBindGroup({
      layout: _fullscreenQuadPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: _sampler
        },
        {
          binding: 1,
          resource: tex.createView()
        }
      ]
    });
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 1, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store"
        }
      ]
    });
    passEncoder.setPipeline(_fullscreenQuadPipeline);
    passEncoder.setBindGroup(0, renderBindGroup);
    passEncoder.draw(4, 1, 0, 0);
    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);
  }
  createBuffer(size) {
    let device = this.gpuDevice;
    let gpuBuffer = device.createBuffer({
      mappedAtCreation: true,
      size,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    return gpuBuffer;
  }
  createTexture(fmt, w, h) {
    fmt = fmt || "rgba8unorm";
    w = w || this.canvas.width;
    h = h || this.canvas.height;
    let device = this.gpuDevice;
    let tex = device.createTexture({
      size: {
        width: w,
        height: h
      },
      format: fmt,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
    });
    tex.size = [w, h, 4];
    return tex;
  }
  async getData(vid, dstarray) {
    function isTypedArray(arr) {
      return ArrayBuffer.isView(arr) && !(arr instanceof DataView);
    }
    function getHostAccessArrary(dstarray2, arrayBuffer2) {
      let hostAccessArrary2 = null;
      if (dstarray2 == void 0) {
        hostAccessArrary2 = new Uint8Array(arrayBuffer2);
      } else if (typeof dstarray2 === "string") {
        const typemap = /* @__PURE__ */ new Map([
          ["int8", Int8Array],
          ["uint8", Uint8Array],
          ["uint8clamped", Uint8ClampedArray],
          ["int16", Int16Array],
          ["uint16", Uint16Array],
          ["int32", Int32Array],
          ["uint32", Uint32Array],
          ["float32", Float32Array],
          ["float", Float32Array],
          ["float64", Float64Array],
          ["bigint", BigInt64Array],
          ["bigint", BigUint64Array]
        ]);
        if (typemap.has(dstarray2)) {
          let obj = typemap.get(dstarray2);
          hostAccessArrary2 = new obj(arrayBuffer2);
        } else {
          hostAccessArrary2 = new Uint8Array(arrayBuffer2);
        }
      } else if (isTypedArray(dstarray2)) {
        hostAccessArrary2 = new dstarray2.constructor(arrayBuffer2);
      } else {
        hostAccessArrary2 = new Uint8Array(arrayBuffer2);
      }
      return hostAccessArrary2;
    }
    const resultBufferSizeInBytes = vid.size || 64 * 64 * 4;
    const gpuReadBuffer = this.gpuDevice.createBuffer({ size: resultBufferSizeInBytes, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    let commandEncoder = this.gpuDevice.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(vid, 0, gpuReadBuffer, 0, resultBufferSizeInBytes);
    const gpuCommands = commandEncoder.finish();
    this.gpuDevice.queue.submit([gpuCommands]);
    await gpuReadBuffer.mapAsync(GPUMapMode.READ);
    const arrayBuffer = gpuReadBuffer.getMappedRange();
    let hostAccessArrary = getHostAccessArrary(dstarray, arrayBuffer);
    if (isTypedArray(dstarray) && dstarray.length == hostAccessArrary.length) {
      dstarray.set(hostAccessArrary);
    } else {
      dstarray = hostAccessArrary.slice();
    }
    gpuReadBuffer.unmap();
    return dstarray;
  }
  __setFmt() {
    let fmts = [
      ["rgba8unorm", "rgba8unorm", "f32", "rgba8"],
      ["rgba8unorm", "rgba8unorm", "f32", "rgba"],
      ["rgba8unorm", "rgba8unorm", "f32", "rgba8unorm"],
      ["rgba8snorm", "rgba8snorm", "f32", "rgba8snorm"],
      ["rgba8uint", "rgba8uint", "u32", "rgba8uint"],
      ["rgba8sint", "rgba8sint", "i32", "rgba8sint"],
      ["rgba16uint", "rgba16uint", "u32", "rgba16uint"],
      ["rgba16sint", "rgba16sint", "i32", "rgba16sint"],
      ["rgba16float", "rgba16float", "f32", "rgba16float"],
      ["r32uint", "r32uint", "u32", "r32uint"],
      ["r32sint", "r32sint", "i32", "r32sint"],
      ["r32float", "r32float", "f32", "r32float"],
      ["rg32uint", "rg32uint", "u32", "rg32uint"],
      ["rg32sint", "rg32sint", "i32", "rg32sint"],
      ["rg32float", "rg32float", "f32", "rg32float"],
      ["rgba32uint", "rgba32uint", "u32", "rgba32uint"],
      ["rgba32sint", "rgba32sint", "i32", "rgba32sint"],
      ["rgba32float", "rgba32float", "f32", "rgba32float"],
      ["u32", "u32", "u32", "u32"],
      ["i32", "i32", "i32", "i32"],
      ["f32", "f32", "f32", "f32"],
      ["f16", "f16", "f16", "f16"],
      ["vec2i", "vec2i", "i32", "vec2<i32>"],
      ["vec2<i32>", "vec2i", "i32", "vec2<i32>"],
      ["vec2u", "vec2u", "u32", "vec2<u32>"],
      ["vec2<u32>", "vec2u", "u32", "vec2<u32>"],
      ["vec2f", "vec2f", "f32", "vec2<f32>"],
      ["vec2<f32>", "vec2f", "f32", "vec2<f32>"],
      ["vec2h", "vec2h", "f16", "vec2<f16>"],
      ["vec2<f16>", "vec2h", "f16", "vec2<f16>"],
      ["vec3i", "vec3i", "i32", "vec3<i32>"],
      ["vec3<i32>", "vec3i", "i32", "vec3<i32>"],
      ["vec3u", "vec3u", "u32", "vec3<u32>"],
      ["vec3<u32>", "vec3u", "u32", "vec3<u32>"],
      ["vec3f", "vec3f", "f32", "vec3<f32>"],
      ["vec3<f32>", "vec3f", "f32", "vec3<f32>"],
      ["vec3h", "vec3h", "f16", "vec3<f16>"],
      ["vec3<f16>", "vec3h", "f16", "vec3<f16>"],
      ["vec4i", "vec4i", "i32", "vec4<i32>"],
      ["vec4<i32>", "vec4i", "i32", "vec4<i32>"],
      ["vec4u", "vec4u", "u32", "vec4<u32>"],
      ["vec4<u32>", "vec4u", "u32", "vec4<u32>"],
      ["vec4f", "vec4f", "f32", "vec4<f32>"],
      ["vec4<f32>", "vec4f", "f32", "vec4<f32>"],
      ["vec4h", "vec4h", "f16", "vec4<f16>"],
      ["vec4<f16>", "vec4h", "f16", "vec4<f16>"],
      ["mat2x2f", "mat2x2f", "f32", "mat2x2<f32>"],
      ["mat2x2<f32>", "mat2x2f", "f32", "mat2x2<f32>"],
      ["mat2x3f", "mat2x3f", "f32", "mat2x3<f32>"],
      ["mat2x3<f32>", "mat2x3f", "f32", "mat2x3<f32>"],
      ["mat2x4f", "mat2x4f", "f32", "mat2x4<f32>"],
      ["mat2x4<f32>", "mat2x4f", "f32", "mat2x4<f32>"],
      ["mat3x2f", "mat3x2f", "f32", "mat3x2<f32>"],
      ["mat3x2<f32>", "mat3x2f", "f32", "mat3x2<f32>"],
      ["mat3x3f", "mat3x3f", "f32", "mat3x3<f32>"],
      ["mat3x3<f32>", "mat3x3f", "f32", "mat3x3<f32>"],
      ["mat3x4f", "mat3x4f", "f32", "mat3x4<f32>"],
      ["mat3x4<f32>", "mat3x4f", "f32", "mat3x4<f32>"],
      ["mat4x2f", "mat4x2f", "f32", "mat4x2<f32>"],
      ["mat4x2<f32>", "mat4x2f", "f32", "mat4x2<f32>"],
      ["mat4x3f", "mat4x3f", "f32", "mat4x3<f32>"],
      ["mat4x3<f32>", "mat4x3f", "f32", "mat4x3<f32>"],
      ["mat4x4f", "mat4x4f", "f32", "mat4x4<f32>"],
      ["mat4x4<f32>", "mat4x4f", "f32", "mat4x4<f32>"]
    ];
    for (let fmt of fmts) {
      this.SFmt2DataType[fmt[0]] = fmt[2];
      this.SFmt2Fmt[fmt[0]] = fmt[1];
      this.Str2SFmt[fmt[3]] = fmt[0];
    }
  }
  __sfmt2datatype(fmt) {
    return this.SFmt2DataType[fmt] || "f32";
  }
  __sfmt2fmt(fmt) {
    return this.SFmt2Fmt[fmt] || "rgba8unorm";
  }
  __str2sfmt(str) {
    return this.Str2SFmt[str] || "rgba8unorm";
  }
}
function displayMatrix(matrix2, name, el, rows, cols, idxBase) {
  if (idxBase == void 0) {
    idxBase = 0;
  }
  let str = [];
  const MAXCOL = 6;
  const MAXROW = 6;
  function makestr(f) {
    return f.toFixed(8);
  }
  if (rows < MAXROW && cols < MAXCOL) {
    let idx = idxBase;
    for (var row = 0; row < rows; row++) {
      str.push("<tr>");
      for (var col = 0; col < cols; col++) {
        str.push("<td>" + makestr(matrix2[idx]) + " </td>");
        idx = idx + 1;
      }
      str.push("</tr>");
    }
  } else {
    let addRow2 = function(row2) {
      const idx = idxBase;
      str.push("<tr>");
      if (cols > MAXCOL) {
        str.push("<td>" + makestr(matrix2[idx + row2 * cols + 0]) + " </td>");
        str.push("<td>" + makestr(matrix2[idx + row2 * cols + 1]) + " </td>");
        str.push("<td>" + makestr(matrix2[idx + row2 * cols + 2]) + " </td>");
        str.push("<td> ... </td>");
        str.push("<td>" + makestr(matrix2[idx + row2 * cols + cols - 3]) + " </td>");
        str.push("<td>" + makestr(matrix2[idx + row2 * cols + cols - 2]) + " </td>");
        str.push("<td>" + makestr(matrix2[idx + row2 * cols + cols - 1]) + " </td>");
      } else {
        for (var ii = 0; ii < cols; ii++) {
          str.push("<td>" + makestr(matrix2[idx + row2 * cols + ii]) + " </td>");
        }
      }
      str.push("</tr>");
    }, addEmptyRow2 = function() {
      str.push("<tr>");
      for (var ii = 0; ii < (cols < 7 ? cols : 7); ii++) {
        str.push("<td> ... </td>");
      }
      str.push("</tr>");
    };
    var addRow = addRow2, addEmptyRow = addEmptyRow2;
    if (rows > 6) {
      addRow2(0);
      addRow2(1);
      addRow2(2);
      addEmptyRow2();
      addRow2(rows - 3);
      addRow2(rows - 2);
      addRow2(rows - 1);
    } else {
      for (var jj = 0; jj < rows; jj++) {
        addRow2(jj);
      }
    }
  }
  let matrixBody = "<table class='matrix'><tbody>" + str.join("") + "</tbody></table>";
  let matrixHtml = `
            <table class="w3-large"><tbody><tr>
            <td>${name}(${rows}x${cols})  =&nbsp;&nbsp;</td>
            <td> ${matrixBody}</td>
            </tr></tbody></table>

            `;
  el.innerHTML = matrixHtml;
}
let webCS = null;
let cs_smm_naive = null;
let cs_texture = null;
let cs_kernels = {};
let gpu_kernels = {};
let do_cs = {};
var X = 512, Y = 512;
(function() {
  let testcases = ["smm_naive", "texture", "texture2", "img_texture", "img_dwt", "histogram", "filter", "filter2"];
  function gpu_smm_naive(A, B, C) {
    return `
               // It is optional to decalare the src or dst in wgsl.
               // Another option is to decalre them when  webCS.createShader : 
               //     param:{A:"f32[]", B:"f32[]", C:"f32[]"}
               var A:array<f32>;
               // var B:array<f32>;
               // var C:array<f32>;

               //  declare the uniform,  must use 'this.uniform'
               // C[M, N] = A[M, K] * B[K, N]
               var mnk:vec4u = this.uniform.MNK;
               var M:u32 = mnk.x;
               var N:u32 = mnk.y;
               var K:u32 = mnk.z;
               // Compute a single element C[thread.y, thread.x] by looping over k
               var sum:f32 = 0.0;
               for (var k:u32 = 0u; k < K; k = k+1u)
               {
                   sum = sum + A[thread.y * K + k] * B[k * N + thread.x];
               }
        
               // Store the result
               C[thread.y*N + thread.x] = sum;
           `;
  }
  function gpu_texcopy(src, dst) {
    return `
        dst[thread.y][thread.x] = src[thread.y][thread.x];     
        `;
  }
  function gpu_texture2(src, dst) {
    return `
        var pos:vec2<u32> = vec2<u32>(thread.xy);
        // vec4 pixel = imageLoad(src, pos); or vec4 pixel = src[pos]
        var pixel:vec4<f32> = src[pos.y][pos.x]; 
        var invert:vec4<f32> = vec4<f32>(1.0 - pixel.x, 1.0 - pixel.y, 1.0 - pixel.z, 1.0);
        // imageStore(dst, pos, invert); or dst[pos] = invert;
        dst[pos.y][pos.x] = invert;     
    `;
  }
  function gpu_texture(dst) {
    return `
        var pos:vec2<u32> = vec2<u32>(thread.xy);
        var x : f32 = f32(thread.x);
        var y : f32 = f32(thread.y);
        //imageStore(dst, pos, vec4(x / (y+1.0+x), y / (y+1.0+x),  0.0, 1.0));
        dst[thread.y][thread.x] =  vec4<f32>(x / (y+1.0+x), y / (y+1.0+x),  0.0, 1.0);
        `;
  }
  function gpu_img_dwt(src, dst) {
    return `
        function  YSize() -> u32{ return u32(g_workgroup_id.y*g_num_workgroups.y);}
        function  XSize() -> u32{ return u32(g_workgroup_id.x*g_num_workgroups.x);} 
        var x:u32 = u32(thread.x);
        var y:u32 = u32(thread.y);
        var p00: vec4<f32> = src[2u*y + 0u][2u*x + 0u];
        var p01: vec4<f32> = src[2u*y + 0u][2u*x + 1u];
        var p10: vec4<f32> = src[2u*y + 1u][2u*x + 0u];
        var p11: vec4<f32> = src[2u*y + 1u][2u*x + 1u];
        dst[y][x] = (p00 + p01 + p10 + p11) / 4.0;
        dst[y][x + XSize()] = (p00 + p10 - p01 - p11) / 4.0;
        dst[y + YSize()][x] = (p00 + p01 - p10 - p11) / 4.0;
        dst[y + YSize()][x + XSize()] = (p00 + p11 - p01 - p10) / 4.0;
        `;
  }
  function gpu_histogram(src, dst) {
    return `
        var pixel:vec4<f32> = src[thread.xy]; 
        var gray: f32 = 0.2126 * pixel.r + 0.7152 * pixel.g + 0.0722 * pixel.b;
        var grayu:u32 = u32(floor(gray * 255.0));
        grayu = grayu & 255u;
        dst[grayu] = dst[grayu] + 1.0;
        //int ru = int(floor(pixel.r*255.0));
        //int gu = int(floor(pixel.g*255.0));
        //int bu = int(floor(pixel.b*255.0));
        //dst[ru + 256] = dst[ru+256] + 1.0;
        //dst[gu + 256*2] = dst[gu+256*2] + 1.0;
        //dst[bu + 256*3] = dst[bu+256*3] + 1.0;
`;
  }
  function gpu_replace(src, dst, histo) {
    return `
        var pixel : vec4<f32> = src[thread.xy]; 
        var gray:f32 = 0.2126 * pixel.r + 0.7152 * pixel.g + 0.0722 * pixel.b;
        var grayu:u32 = u32(floor(gray * 255.0));
        grayu = grayu & 255u;
        var new_gray:f32 = histo[grayu];
        var diff_gray:f32 = new_gray - gray;
        var new_pixel:vec4<f32> = vec4(pixel.r + diff_gray * 0.2126, pixel.g + diff_gray * 0.7152, pixel.b + diff_gray * 0.0722, 1.0);
        dst[thread.xy] = new_pixel;
        `;
  }
  function gpu_filter(src, dst) {
    return `
    const kernel = mat3x3f(
        1.0,1.0,1.0,
        0.0,0.0,0.0,
        -1.0,-1.0,-1.0);
    var pos:vec2<u32> = vec2<u32>(thread.xy);
    var sum:vec4<f32> = vec4<f32>(0.0,0.0,0.0,1.0);
    for(var j:u32=0; j<3; j++){
        for(var i:u32=0; i<3; i++){
            let pixel = src[pos.y + j -1][pos.x + i -1];
            sum = sum + pixel * kernel[j][i];
        }
    }
    dst[pos.y][pos.x] = sum;     
    `;
  }
  function gpu_filter2(src, dst) {
    return `
    // It is optional to decalare the src or dst in wgsl.
    // Another option is to decalre them when  webCS.createShader : 
    //     params: { src: 'texture', 'dst': 'texture' }  // compiler will deduce the final type 
    var src : texture_2d<f32>;
    //var dst:texture_storage_2d<rgba8unorm,write>;
    var kernel:mat3x3f = this.uniform.KERNEL;
    var pos:vec2<u32> = vec2<u32>(thread.xy);
    var sum:vec4<f32> = vec4<f32>(0.0,0.0,0.0,1.0);
    for(var j:u32=0; j<3; j++){
        for(var i:u32=0; i<3; i++){
            let pixel = src[pos.y + j -1][pos.x + i -1];
            sum = sum + pixel * kernel[j][i];
        }
    }
    dst[pos.y][pos.x] = sum;     
    `;
  }
  gpu_kernels.smm_naive = gpu_smm_naive;
  gpu_kernels.texture = gpu_texture;
  gpu_kernels.texture2 = gpu_texture2;
  gpu_kernels.img_texture = gpu_texture2;
  gpu_kernels.img_dwt = gpu_img_dwt;
  gpu_kernels.histogram = gpu_histogram;
  gpu_kernels.filter = gpu_filter;
  gpu_kernels.filter2 = gpu_filter2;
  (function() {
    do_cs.do_smm_naive = async function(kernel_name) {
      var M = 64, N = 64, K = 64;
      var createArray = function(n) {
        var buf = new Float32Array(n);
        for (var i = 0; i < n; i++) {
          buf[i] = Math.random();
        }
        return buf;
      };
      let cpuA = createArray(M * K);
      let cpuB = createArray(K * N);
      let cpuC = createArray(M * N);
      if (cs_smm_naive == null) {
        cs_smm_naive = webCS.createShader(gpu_smm_naive, { local_size: [8, 8, 1], groups: [M / 8, N / 8, 1] });
      }
      const t0 = performance.now();
      await cs_smm_naive.run(cpuA, cpuB, cpuC, { "MNK": [M, N, K, 0] });
      const t1 = performance.now();
      let t = t1 - t0;
      $("#time").html(t.toFixed(1).toString());
      {
        let acc = 0, x = Math.floor(N * Math.random()), y = Math.floor(N * Math.random());
        for (let k = 0; k < K; k++)
          acc += cpuA[y * K + k] * cpuB[k * N + x];
        cpuC = await cs_smm_naive.getData("C", "float");
        let result = cpuC[y * N + x];
        let diff = result - acc;
        result = result.toFixed(7);
        diff = diff.toFixed(7);
        App.showMessage(`Cgpu[${y},${x}] = ${result}; \u2003<br/> Cgpu[${y},${x}] - Ccpu[${y},${x}] : ${diff}`);
        displayMatrix(cpuA, "gpuA", $("#data0_div")[0], M, K);
        displayMatrix(cpuB, "gpuB", $("#data1_div")[0], K, K);
        displayMatrix(cpuC, "gpuC", $("#data2_div")[0], M, N);
        $("#data_div").show();
      }
      $("#code_smm_naive").show();
    };
    do_cs.do_texture = async function(kernel_name) {
      if (cs_texture == null) {
        cs_texture = webCS.createShader(gpu_texture, { local_size: [8, 8, 1], groups: [X / 8, Y / 8, 1], params: { "dst": "texture" } });
      }
      await cs_texture.run(null);
      let tex = cs_texture.getTexture("dst");
      webCS.present(tex);
      $("#display1")[0].appendChild(webCS.canvas);
      $(webCS.canvas).show();
    };
    do_cs.do_texture2 = async function(kernel_name) {
      do_cs.do_texture();
      if (cs_kernels["texture2"] == null) {
        cs_kernels["texture2"] = webCS.createShader(gpu_texture2, { local_size: [8, 8, 1], groups: [X / 8, Y / 8, 1], params: { src: "[][]", "dst": "rgba8[][]" } });
      }
      let texSrc = cs_texture.getTexture("dst");
      await cs_kernels["texture2"].run(texSrc, null);
      let tex = cs_kernels["texture2"].getTexture("dst");
      webCS.present(tex);
      $("#display1")[0].appendChild(webCS.canvas);
      $(webCS.canvas).show();
    };
    do_cs.do_img_dwt = async function(kernel_name) {
      if (cs_kernels.cs_img_dwt == null) {
        cs_kernels.cs_img_dwt = webCS.createShader(gpu_img_dwt, { local_size: [8, 8, 1], groups: [X / 16, Y / 16, 1], params: { src: "texture", "dst": "texture" } });
      }
      if (cs_kernels.cs_texcopy == null) {
        cs_kernels.cs_texcopy = webCS.createShader(gpu_texcopy, { local_size: [8, 8, 1], groups: [X / 8, Y / 8, 1], params: { src: "[][]", "dst": "[][]" } });
      }
      let texSrc = $("#image000")[0];
      let texDst1 = webCS.createTexture();
      let texDst2 = webCS.createTexture();
      await cs_kernels.cs_img_dwt.setGroups(X / 16, Y / 16, 1).run(texSrc, texDst1);
      await cs_kernels.cs_texcopy.setGroups(X / 16, Y / 16, 1).run(texDst1, texDst2);
      await cs_kernels.cs_img_dwt.run(texDst2, texDst1, X / 32, Y / 32, 1);
      let tex = cs_kernels.cs_img_dwt.getTexture("dst");
      webCS.present(tex);
      $("#display1")[0].appendChild(webCS.canvas);
      $(webCS.canvas).show();
    };
    do_cs.do_img_texture = async function(kernel_name) {
      if (cs_kernels["texture2"] == null) {
        cs_kernels["texture2"] = webCS.createShader(gpu_texture2, { local_size: [8, 8, 1], groups: [X / 8, Y / 8, 1], params: { src: "texture", "dst": "texture" } });
      }
      let texSrc = $("#image000")[0];
      await cs_kernels["texture2"].run(texSrc, null);
      let tex = cs_kernels["texture2"].getTexture("dst");
      webCS.present(tex);
      $("#display1")[0].appendChild(webCS.canvas);
      $(webCS.canvas).show();
    };
    do_cs.do_filter = async function(kernel_name) {
      {
        cs_kernels["filter"] = webCS.createShader(gpu_filter, { local_size: [8, 8, 1], groups: [X / 8, Y / 8, 1], params: { src: "texture", "dst": "texture" } });
      }
      let texSrc = $("#image000")[0];
      await cs_kernels["filter"].run(texSrc, null);
      let tex = cs_kernels["filter"].getTexture("dst");
      webCS.present(tex);
      $("#display1")[0].appendChild(webCS.canvas);
      $(webCS.canvas).show();
    };
    do_cs.do_filter2 = async function(kernel_name) {
      {
        cs_kernels["filter2"] = webCS.createShader(gpu_filter2, { local_size: [8, 8, 1], groups: [X / 8, Y / 8, 1], params: { src: "texture", "dst": "texture" } });
      }
      let texSrc = $("#image000")[0];
      await cs_kernels["filter2"].run(texSrc, null, { "KERNEL": [1, 1, 1, 0, 0, 0, 0, 0, -1, -1, -1, 0] });
      let tex = cs_kernels["filter2"].getTexture("dst");
      webCS.present(tex);
      $("#display1")[0].appendChild(webCS.canvas);
      $(webCS.canvas).show();
    };
    do_cs.do_general = async function(kernel_name) {
      if (cs_kernels["texture2"] == null) {
        cs_kernels["texture2"] = webCS.createShader(gpu_kernels[kernel_name], { local_size: [8, 8, 1], groups: [X / 8, Y / 8, 1], params: { src: "texture", "dst": "texture" } });
      }
      let texSrc = $("#image000")[0];
      await cs_kernels["texture2"].run(texSrc, null);
      let tex = cs_kernels["texture2"].getTexture("dst");
      webCS.present(tex);
      $("#display1")[0].appendChild(webCS.canvas);
      $(webCS.canvas).show();
    };
    do_cs.do_histogram = async function(kernel_name) {
      if (cs_kernels["histogram "] == null) {
        cs_kernels["histogram "] = webCS.createShader(gpu_histogram, { local_size: [8, 8, 1], groups: [X / 8, Y / 8, 1], params: { src: "texture", "dst": "float[]" } });
      }
      let texSrc = $("#image000")[0];
      let bufHis = webCS.createBuffer(256 * 4 * 4);
      await cs_kernels["histogram "].run(texSrc, bufHis);
      let histogram = await cs_kernels["histogram "].getData("dst", "float");
      for (let ii = 1; ii < 256; ii++) {
        histogram[ii] = histogram[ii - 1] + histogram[ii];
      }
      let cdf0 = 0, cdf1 = histogram[255];
      let newColor = new Float32Array(256);
      for (let ii = 0; ii < 256; ii++) {
        if (histogram[ii] == 0) {
          continue;
        }
        if (cdf0 == 0) {
          cdf0 = histogram[ii];
        }
        newColor[ii] = (histogram[ii] - cdf0) / (cdf1 - cdf0) * 255 / 255;
      }
      console.log(histogram);
      if (cs_kernels["replace"] == null) {
        cs_kernels["replace"] = webCS.createShader(gpu_replace, {
          local_size: [8, 8, 1],
          groups: [X / 8, Y / 8, 1],
          params: { src: "texture", "dst": "texture", histo: "float[]" }
        });
      }
      await cs_kernels["replace"].run(texSrc, null, newColor);
      let tex = cs_kernels["replace"].getTexture("dst");
      webCS.present(tex);
      $("#display1")[0].appendChild(webCS.canvas);
      $("#canvas2GPU").show();
    };
    function doExampleGPU(e, ui) {
      let myfilter = ui.item.attr("data-filter");
      $(".code.example").hide();
      $("#canvas2GPU").hide();
      $("#data_div").hide();
      $("#code_" + myfilter).show();
      if ("do_" + myfilter in do_cs) {
        do_cs["do_" + myfilter](myfilter);
      } else {
        do_cs["do_general"](myfilter);
      }
    }
    async function doExample(e, ui) {
      let myfilter = ui.item.attr("data-filter");
      if (webCS == null) {
        webCS = await WebCS.create({ canvas: $("#canvas2GPU")[0] });
      }
      if (myfilter == null) {
        return;
      }
      disablePractice();
      doExampleGPU(e, ui);
    }
    function disablePractice() {
      $("#GPUToggleButton").prop("checked", true);
      $("#GPUToggleButton").click();
      $("#practice_div").hide();
      $("#code_div").show();
    }
    (function appendmenu() {
      function doone(thefilters, themenu) {
        let ula = $("<ul/>");
        thefilters.forEach(function(ele) {
          ula.append("<li data-filter='" + ele + "'><div>" + ele + "</div></li>");
        });
        $(themenu).append(ula.children().detach());
      }
      doone(testcases, "#example_menus");
      doone(testcases, "#loadexample_menus");
    })();
    $("#examplemenu").menu({ select: doExample });
  })();
  (async function setupExample() {
    let codes_block = $("#codes_block");
    testcases.forEach(function(ele) {
      let code_ele = $(`<code id='code_${ele}' class='code example language-javascript'></code>`);
      var btf = hljs.highlight("c++", gpu_kernels[ele].toString());
      let btf_value = btf.value;
      if (ele == "histogram") {
        let r2 = hljs.highlight("c++", gpu_replace.toString()).value;
        btf_value = btf_value + "\n" + r2;
      }
      let btf2 = hljs.highlight("javascript", ("do_" + ele in do_cs ? do_cs["do_" + ele] : do_cs["do_general"]).toString());
      let btf2_value = btf2.value.replace("gpu_" + ele, '<span class="hljs-title">gpu_' + ele + "</span>");
      {
        btf2_value = "await (" + btf2_value + ")();";
      }
      code_ele.html('<div class="gpu_code example">' + btf_value + '<br/><br/>        </div><div class="js_code example">' + btf2_value + "</div>");
      codes_block.append(code_ele);
    });
    $(".code.example").hide();
    $("#code_smm_naive").show();
  })();
})();
$(function() {
  var editorgpu = CodeMirror.fromTextArea(document.getElementById("practisegpu"), { lineNumbers: true, mode: "text/x-c++src", matchBrackets: true });
  var editorjs = CodeMirror.fromTextArea(document.getElementById("practisejs"), { lineNumbers: true, mode: "javascript", matchBrackets: true });
  $("#run_practise").button();
  $("#run_practise").click(function() {
    formatall(editorgpu);
    formatall(editorjs);
    let test_str = editorgpu.getValue() + "\n (" + editorjs.getValue() + ')("test")';
    eval(test_str);
  });
  function formatall(editor) {
    let oldSize = editorgpu.getScrollInfo();
    var totalLines = editor.lineCount();
    editor.autoFormatRange({ line: 0, ch: 0 }, { line: totalLines });
    editorgpu.setSize(oldSize.width, oldSize.height);
  }
  function setPractice() {
    if ($("#GPUToggleButton").is(":checked")) {
      $("#practice_div").show();
      $("#code_div").hide();
    } else {
      $("#practice_div").hide();
      $("#code_div").show();
    }
  }
  if (document.location.hash === "#practise") {
    $("#GPUToggleButton").prop("checked", true);
  }
  setPractice();
  $("#GPUToggleButton").click(setPractice);
  async function loadExample(e, ui) {
    let myfilter = ui.item.attr("data-filter");
    if (myfilter == null) {
      return;
    }
    $("#GPUToggleButton").prop("checked", true);
    setPractice();
    if (webCS == null) {
      webCS = await WebCS.create({ canvas: $("#canvas2GPU")[0] });
    }
    let ele = myfilter;
    editorgpu.setValue(gpu_kernels[ele].toString());
    editorjs.setValue(("do_" + ele in do_cs ? do_cs["do_" + ele] : do_cs["do_general"]).toString());
  }
  $("#loadexamplemenu").menu({ select: loadExample });
});
