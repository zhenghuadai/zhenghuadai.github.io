#GPU编程快速入门

以将图像反色处理为例。

## *首先编写kernel*
```c
// 0. 函数名glsl_invert, 
//    src 为输入图像(HTMLCanvasElement 或 HTMLImageElement)，
//    dst 为输出图像
function glsl_invert(src, dst){
    return `
    // 1. 取得 threadid 
    ivec2 pos = ivec2(thread.xy);
    // 2. 根据 threadid 从输入图像读入像素
    vec4 pixel = src[pos.y][pos.x]; 
    // 3. 将像素反色
    vec4 invert = vec4(1.0 - pixel.x, 1.0 - pixel.y, 1.0 - pixel.z, 1.0);
    // 4. 将反色像素存入dst
    dst[pos.y][pos.x] = invert;     
    `;
}
```

## *然后在javascript中执行kernel*
```javascript
//1. 生成一个WebCS实例， canvas将用于显示图像 
let webCS = new WebCS({canvas:$("#canvas2GPU")[0]}); //let webCS = new WebCS({width:512, height:512});

//2. 从glsl_invert函数生成shader实例cs_texture2
let cs_texture2 = webCS.createShader(glsl_invert, { local_size:[8, 8, 1], params:{src:'texture', 'dst':'texture'}});

//3. 在GPU上执行cs_texture2
let texSrc = $('#image000')[0];
cs_texture2.setGroups(512/8, 512/8, 1).run(texSrc, null);

//4. 获得dst指向的texture对象 
let tex = cs_texture2.getTexture('dst');

//5. 将tex渲染到默认canvas
webCS.present(tex);

//6. 显示 canvas
$("#display1")[0].appendChild(webCS.canvas);
```

## 思考:
根据公式 gray = 0.2126 * r + 0.7152 * g + 0.0722 * b 将图像转换为灰度图
## **去[练习](http://blog.biosuefi.com/webCS.html#practise)**
