import React, {useEffect, useLayoutEffect, useRef} from "react";
import {Img, cancelRender, continueRender, delayRender, getRemotionEnvironment, staticFile, useVideoConfig} from "remotion";

const ART_WIDTH = 2021;
const ART_HEIGHT = 1600;
const ARTWORK = "artworks/starry-night.webp";

const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = vec2((a_position.x + 1.0) * 0.5, (1.0 - a_position.y) * 0.5);
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// All coordinates refer to the original painting, with the origin at its top left.
// We move the painted strokes themselves, keeping the foreground and image edges still.
const FRAGMENT_SHADER = `
precision highp float;
uniform sampler2D u_painting;
uniform float u_time;
uniform float u_motion;
varying vec2 v_uv;

vec2 vortex(vec2 uv, vec2 center, float radius, float angle) {
  vec2 aspect = vec2(1.263125, 1.0);
  vec2 delta = (uv - center) * aspect;
  float falloff = exp(-dot(delta, delta) / (radius * radius));
  float theta = angle * falloff;
  float s = sin(theta);
  float c = cos(theta);
  vec2 rotated = vec2(c * delta.x - s * delta.y, s * delta.x + c * delta.y);
  return (rotated - delta) / aspect;
}

float starGlow(vec2 uv, vec2 center, float radius, float phase) {
  vec2 d = (uv - center) * vec2(1.263125, 1.0);
  float halo = exp(-dot(d, d) / (radius * radius));
  return halo * (0.54 + 0.46 * sin(u_time * 0.64 + phase));
}

void main() {
  vec2 uv = v_uv;
  float edge = smoothstep(0.005, 0.038, uv.x)
    * (1.0 - smoothstep(0.960, 0.995, uv.x))
    * smoothstep(0.005, 0.032, uv.y);
  float horizon = 0.741 - 0.176 * smoothstep(0.56, 1.0, uv.x);
  float sky = 1.0 - smoothstep(horizon - 0.070, horizon, uv.y);

  float treeCenter = 0.195 + 0.072 * uv.y * uv.y;
  float treeWidth = 0.013 + 0.125 * pow(smoothstep(0.055, 0.86, uv.y), 1.6);
  float tree = (1.0 - smoothstep(treeWidth, treeWidth + 0.018, abs(uv.x - treeCenter)))
    * smoothstep(0.045, 0.065, uv.y);
  float motionMask = sky * edge * (1.0 - tree) * u_motion;

  // Broad currents follow the two existing curls. Tiny longitudinal waves connect them.
  vec2 flow = vortex(uv, vec2(0.511, 0.338), 0.232,
    0.100 * sin(u_time * 0.255));
  flow += vortex(uv, vec2(0.686, 0.470), 0.132,
    -0.155 * sin(u_time * 0.315));
  flow += vortex(uv, vec2(0.904, 0.173), 0.135,
    0.035 * sin(u_time * 0.235));
  flow += vec2(
    0.0036 * sin(uv.y * 27.0 + uv.x * 7.0 - u_time * 0.41),
    0.0027 * sin(uv.x * 23.0 - uv.y * 8.0 - u_time * 0.36)
  ) * sin(u_time * 0.20);

  // The moon's center stays legible while the painted halo moves around it.
  vec2 moonDistance = (uv - vec2(0.902, 0.167)) * vec2(1.263125, 1.0);
  float moonProtection = smoothstep(0.031, 0.092, length(moonDistance));
  vec2 sampleUv = clamp(uv + flow * motionMask * moonProtection, 0.001, 0.999);
  vec4 paint = texture2D(u_painting, sampleUv);

  float glow = starGlow(uv, vec2(0.107, 0.045), 0.061, 0.1);
  glow += starGlow(uv, vec2(0.234, 0.035), 0.027, 1.5);
  glow += starGlow(uv, vec2(0.344, 0.040), 0.050, 2.6);
  glow += starGlow(uv, vec2(0.408, 0.066), 0.032, 3.8);
  glow += starGlow(uv, vec2(0.612, 0.086), 0.058, 2.0);
  glow += starGlow(uv, vec2(0.238, 0.176), 0.051, 4.4);
  glow += starGlow(uv, vec2(0.706, 0.234), 0.039, 1.0);
  glow += starGlow(uv, vec2(0.327, 0.326), 0.035, 3.1);
  glow += starGlow(uv, vec2(0.046, 0.450), 0.034, 2.3);
  glow += starGlow(uv, vec2(0.134, 0.480), 0.042, 5.0);
  glow += starGlow(uv, vec2(0.357, 0.532), 0.070, 0.8);
  glow += starGlow(uv, vec2(0.900, 0.171), 0.117, 3.5) * 0.72;

  float warmPaint = smoothstep(-0.12, 0.28, paint.r - paint.b);
  float radiance = glow * u_motion * (1.0 - tree) * edge;
  vec3 color = paint.rgb * (1.0 + radiance * warmPaint * 0.072);
  color += vec3(1.0, 0.69, 0.22) * radiance * 0.019;
  gl_FragColor = vec4(color, 1.0);
}
`;

type PaintingRenderer = {
  draw: (seconds: number, still: boolean) => void;
  dispose: () => void;
};

const createPaintingRenderer = (
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
): PaintingRenderer | null => {
  const isRendering = getRemotionEnvironment().isRendering;
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  if (!gl) {
    if (isRendering) {
      cancelRender(new Error("Starry Night requires WebGL animation during export. Unable to create a WebGL context; render with a supported Chromium GL backend, such as --gl=angle."));
    }
    return null;
  }

  const shaders: WebGLShader[] = [];
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  let texture: WebGLTexture | null = null;

  const dispose = () => {
    if (texture) gl.deleteTexture(texture);
    if (buffer) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
    shaders.forEach((shader) => gl.deleteShader(shader));
  };

  try {
    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Unable to create painting shader");
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) ?? "Painting shader compilation failed");
      }
      return shader;
    };

    program = gl.createProgram();
    if (!program) throw new Error("Unable to create painting program");
    gl.attachShader(program, compileShader(gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? "Painting shader link failed");
    }
    gl.useProgram(program);

    buffer = gl.createBuffer();
    if (!buffer) throw new Error("Unable to create painting vertices");
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    texture = gl.createTexture();
    if (!texture) throw new Error("Unable to create painting texture");
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.uniform1i(gl.getUniformLocation(program, "u_painting"), 0);

    const time = gl.getUniformLocation(program, "u_time");
    const motion = gl.getUniformLocation(program, "u_motion");
    gl.viewport(0, 0, ART_WIDTH, ART_HEIGHT);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    return {
      draw: (seconds, still) => {
        if (gl.isContextLost()) {
          if (isRendering) {
            cancelRender(new Error("Starry Night WebGL context was lost during export. Retry with a supported GL backend and lower render concurrency."));
          }
          return;
        }
        gl.uniform1f(time, still ? 0 : seconds);
        gl.uniform1f(motion, still ? 0 : 1);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        // Complete every frame before Remotion takes its screenshot.
        gl.finish();
      },
      dispose,
    };
  } catch (error) {
    dispose();
    if (isRendering) {
      const reason = error instanceof Error ? error.message : String(error);
      cancelRender(new Error(`Starry Night animation initialization failed during export: ${reason}`));
    }
    console.warn("Starry Night animation unavailable; showing the original artwork.", error);
    return null;
  }
};

export type StarryPaintingProps = {
  frame: number;
  still?: boolean;
  style?: React.CSSProperties;
};

export const StarryPainting: React.FC<StarryPaintingProps> = ({frame, still = false, style}) => {
  const {fps} = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<PaintingRenderer | null>(null);
  const frameRef = useRef({frame, still, fps});

  useLayoutEffect(() => {
    frameRef.current = {frame, still, fps};
    rendererRef.current?.draw(frame / fps, still);
  }, [frame, fps, still]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handle = delayRender("Loading the Starry Night painting texture");
    let released = false;
    let cancelled = false;
    const release = () => {
      if (released) return;
      released = true;
      continueRender(handle);
    };
    const image = new Image();
    const onContextLost = (event: Event) => {
      event.preventDefault();
      if (getRemotionEnvironment().isRendering) {
        cancelRender(new Error("Starry Night WebGL context was lost during export. Retry with a supported GL backend and lower render concurrency."));
      }
      // The Remotion Img beneath the canvas remains a complete fallback.
      canvas.style.opacity = "0";
    };
    canvas.addEventListener("webglcontextlost", onContextLost);
    image.onload = () => {
      if (cancelled) return;
      rendererRef.current = createPaintingRenderer(canvas, image);
      const current = frameRef.current;
      rendererRef.current?.draw(current.frame / current.fps, current.still);
      release();
    };
    image.onerror = release;
    image.src = staticFile(ARTWORK);

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
      canvas.removeEventListener("webglcontextlost", onContextLost);
      rendererRef.current?.dispose();
      rendererRef.current = null;
      release();
    };
  }, []);

  return (
    <div style={{position: "absolute", inset: 0, overflow: "hidden", ...style}}>
      <Img
        src={staticFile(ARTWORK)}
        alt="文森特·梵高，《星月夜》，1889 年"
        style={{position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "fill"}}
      />
      <canvas
        ref={canvasRef}
        width={ART_WIDTH}
        height={ART_HEIGHT}
        aria-hidden="true"
        style={{position: "absolute", inset: 0, width: "100%", height: "100%", display: "block"}}
      />
    </div>
  );
};
