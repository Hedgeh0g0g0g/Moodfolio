//add แล้วนะไอเวร
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, Trash2, PlusCircle, Save, Edit, BookOpen } from 'lucide-react';
// Import Three.js necessary modules
import {
  Scene,
  OrthographicCamera,
  WebGLRenderer,
  PlaneGeometry,
  Mesh,
  ShaderMaterial,
  Vector3,
  Vector2,
  Clock
} from 'three';

// === CONSTANTS ===
const MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
  'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
  'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];
const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

// รายการอารมณ์เริ่มต้น (Default Moods)
const DEFAULT_MOODS = [
  { id: 'happy', emoji: '😄', label: 'มีความสุข', color_tailwind: 'bg-yellow-400', is_custom: false },
  { id: 'calm', emoji: '😊', label: 'สงบ', color_tailwind: 'bg-green-400', is_custom: false },
  { id: 'neutral', emoji: '😐', label: 'เฉยๆ', color_tailwind: 'bg-gray-400', is_custom: false },
  { id: 'anxious', emoji: '😟', label: 'กังวล', color_tailwind: 'bg-orange-400', is_custom: false },
  { id: 'angry', emoji: '😠', label: 'โกรธ', color_tailwind: 'bg-red-500', is_custom: false },
  { id: 'sad', emoji: '😢', label: 'เศร้า', color_tailwind: 'bg-blue-400', is_custom: false },
  { id: 'tired', emoji: '😴', label: 'เหนื่อย', color_tailwind: 'bg-purple-400', is_custom: false },
  { id: 'strong', emoji: '💪', label: 'มีพลัง', color_tailwind: 'bg-teal-400', is_custom: false },
];

// === UTILITY FUNCTIONS ===
const getCalendarData = (year, monthIndex) => {
  const date = new Date(year, monthIndex, 1);
  const firstDayOfMonth = date.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) { days.push(null); }
  for (let i = 1; i <= daysInMonth; i++) { days.push(i); }

  const totalSlots = 42;
  const emptyDaysEnd = totalSlots - days.length;
  for (let i = 0; i < emptyDaysEnd; i++) { days.push(null); }

  return days;
};

// === SHADER CODE (Unchanged) ===
const vertexShader = `
precision highp float;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform float iTime;
uniform vec3  iResolution;
uniform float animationSpeed;

uniform bool enableTop;
uniform bool enableMiddle;
uniform bool enableBottom;

uniform int topLineCount;
uniform int middleLineCount;
uniform int bottomLineCount;

uniform float topLineDistance;
uniform float middleLineDistance;
uniform float bottomLineDistance;

uniform vec3 topWavePosition;
uniform vec3 middleWavePosition;
uniform vec3 bottomWavePosition;

uniform vec2 iMouse;
uniform bool interactive;
uniform float bendRadius;
uniform float bendStrength;
uniform float bendInfluence;

uniform bool parallax;
uniform float parallaxStrength;
uniform vec2 parallaxOffset;

uniform vec3 lineGradient[8];
uniform int lineGradientCount;

const vec3 BLACK = vec3(0.0);
const vec3 PINK  = vec3(233.0, 71.0, 245.0) / 255.0;
const vec3 BLUE  = vec3(47.0,  75.0, 162.0) / 255.0;

mat2 rotate(float r) {
  return mat2(cos(r), sin(r), -sin(r), cos(r));
}

vec3 background_color(vec2 uv) {
  vec3 col = vec3(0.0);
  float y = sin(uv.x - 0.2) * 0.3 - 0.1;
  float m = uv.y - y;

  col += mix(BLUE, BLACK, smoothstep(0.0, 1.0, abs(m)));
  col += mix(PINK, BLACK, smoothstep(0.0, 1.0, abs(m - 0.8)));
  return col * 0.5;
}

vec3 getLineColor(float t, vec3 baseColor) {
  if (lineGradientCount <= 0) {
    return baseColor;
  }

  vec3 gradientColor;
  
  if (lineGradientCount == 1) {
    gradientColor = lineGradient[0];
  } else {
    float clampedT = clamp(t, 0.0, 0.9999);
    float scaled = clampedT * float(lineGradientCount - 1);
    int idx = int(floor(scaled));
    float f = fract(scaled);
    int idx2 = min(idx + 1, lineGradientCount - 1);

    vec3 c1 = lineGradient[idx];
    vec3 c2 = lineGradient[idx2];
    
    gradientColor = mix(c1, c2, f);
  }
  
  return gradientColor * 0.5;
}

float wave(vec2 uv, float offset, vec2 screenUv, vec2 mouseUv, bool shouldBend) {
  float time = iTime * animationSpeed;

  float x_offset    = offset;
  float x_movement = time * 0.1;
  float amp        = sin(offset + time * 0.2) * 0.3;
  float y          = sin(uv.x + x_offset + x_movement) * amp;

  if (shouldBend) {
    vec2 d = screenUv - mouseUv;
    float influence = exp(-dot(d, d) * bendRadius); // radial falloff around cursor
    float bendOffset = (mouseUv.y - screenUv.y) * influence * bendStrength * bendInfluence;
    y += bendOffset;
  }

  float m = uv.y - y;
  return 0.0175 / max(abs(m) + 0.01, 1e-3) + 0.01;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 baseUv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
  baseUv.y *= -1.0;
  
  if (parallax) {
    baseUv += parallaxOffset;
  }

  vec3 col = vec3(0.0);

  vec3 b = lineGradientCount > 0 ? vec3(0.0) : background_color(baseUv);

  vec2 mouseUv = vec2(0.0);
  if (interactive) {
    mouseUv = (2.0 * iMouse - iResolution.xy) / iResolution.y;
    mouseUv.y *= -1.0;
  }
  
  if (enableBottom) {
    for (int i = 0; i < bottomLineCount; ++i) {
      float fi = float(i);
      float t = fi / max(float(bottomLineCount - 1), 1.0);
      vec3 lineCol = getLineColor(t, b);
      
      float angle = bottomWavePosition.z * log(length(baseUv) + 1.0);
      vec2 ruv = baseUv * rotate(angle);
      col += lineCol * wave(
        ruv + vec2(bottomLineDistance * fi + bottomWavePosition.x, bottomWavePosition.y),
        1.5 + 0.2 * fi,
        baseUv,
        mouseUv,
        interactive
      ) * 0.2;
    }
  }

  if (enableMiddle) {
    for (int i = 0; i < middleLineCount; ++i) {
      float fi = float(i);
      float t = fi / max(float(middleLineCount - 1), 1.0);
      vec3 lineCol = getLineColor(t, b);
      
      float angle = middleWavePosition.z * log(length(baseUv) + 1.0);
      vec2 ruv = baseUv * rotate(angle);
      col += lineCol * wave(
        ruv + vec2(middleLineDistance * fi + middleWavePosition.x, middleWavePosition.y),
        2.0 + 0.15 * fi,
        baseUv,
        mouseUv,
        interactive
      );
    }
  }

  if (enableTop) {
    for (int i = 0; i < topLineCount; ++i) {
      float fi = float(i);
      float t = fi / max(float(topLineCount - 1), 1.0);
      vec3 lineCol = getLineColor(t, b);
      
      float angle = topWavePosition.z * log(length(baseUv) + 1.0);
      vec2 ruv = baseUv * rotate(angle);
      ruv.x *= -1.0;
      col += lineCol * wave(
        ruv + vec2(topLineDistance * fi + topWavePosition.x, topWavePosition.y),
        1.0 + 0.2 * fi,
        baseUv,
        mouseUv,
        interactive
      ) * 0.1;
    }
  }

  fragColor = vec4(col, 1.0);
}

void main() {
  vec4 color = vec4(0.0);
  mainImage(color, gl_FragCoord.xy);
  gl_FragColor = color;
}
`;
// === END SHADER CODE ===

const MAX_GRADIENT_STOPS = 8; // Keep this one

function hexToVec3(hex) { // Keep this one
  let value = hex.trim();

  if (value.startsWith('#')) {
    value = value.slice(1);
  }

  let r = 255;
  let g = 255;
  let b = 255;

  if (value.length === 3) {
    r = parseInt(value[0] + value[0], 16);
    g = parseInt(value[1] + value[1], 16);
    b = parseInt(value[2] + value[2], 16);
  } else if (value.length === 6) {
    r = parseInt(value.slice(0, 2), 16);
    g = parseInt(value.slice(2, 4), 16);
    b = parseInt(value.slice(4, 6), 16);
  }

  return new Vector3(r / 255, g / 255, b / 255);
}

// === FLOATING LINES COMPONENT (Unchanged functional core) ===
function FloatingLines({
  linesGradient = ['#3C00A0', '#7E00FF', '#C700FF'],
  enabledWaves = ['top', 'middle', 'bottom'],
  lineCount = [10, 15, 20],
  lineDistance = [8, 6, 4],
  topWavePosition,
  middleWavePosition,
  bottomWavePosition = { x: 2.0, y: -0.7, rotate: -1 },
  animationSpeed = 0.5,
  interactive = true,
  bendRadius = 5.0,
  bendStrength = -0.5,
  mouseDamping = 0.05,
  parallax = true,
  parallaxStrength = 0.05,
  mixBlendMode = 'screen'
}) {
  const containerRef = useRef(null);
  const targetMouseRef = useRef(new Vector2(-1000, -1000));
  const currentMouseRef = useRef(new Vector2(-1000, -1000));
  const targetInfluenceRef = useRef(0);
  const currentInfluenceRef = useRef(0);
  const targetParallaxRef = useRef(new Vector2(0, 0));
  const currentParallaxRef = useRef(new Vector2(0, 0));

  const getLineCount = waveType => {
    if (typeof lineCount === 'number') return lineCount;
    if (!enabledWaves.includes(waveType)) return 0;
    const index = enabledWaves.indexOf(waveType);
    return lineCount[index] ?? 6;
  };

  const getLineDistance = waveType => {
    if (typeof lineDistance === 'number') return lineDistance;
    if (!enabledWaves.includes(waveType)) return 0.1;
    const index = enabledWaves.indexOf(waveType);
    return lineDistance[index] ?? 0.1;
  };

  const topLineCount = enabledWaves.includes('top') ? getLineCount('top') : 0;
  const middleLineCount = enabledWaves.includes('middle') ? getLineCount('middle') : 0;
  const bottomLineCount = enabledWaves.includes('bottom') ? getLineCount('bottom') : 0;

  const topLineDistance = enabledWaves.includes('top') ? getLineDistance('top') * 0.01 : 0.01;
  const middleLineDistance = enabledWaves.includes('middle') ? getLineDistance('middle') * 0.01 : 0.01;
  const bottomLineDistance = enabledWaves.includes('bottom') ? getLineDistance('bottom') * 0.01 : 0.01;

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new Scene();

    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    camera.position.z = 1;

    const renderer = new WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    containerRef.current.appendChild(renderer.domElement);

    const uniforms = {
      iTime: { value: 0 },
      iResolution: { value: new Vector3(1, 1, 1) },
      animationSpeed: { value: animationSpeed },

      enableTop: { value: enabledWaves.includes('top') },
      enableMiddle: { value: enabledWaves.includes('middle') },
      enableBottom: { value: enabledWaves.includes('bottom') },

      topLineCount: { value: topLineCount },
      middleLineCount: { value: middleLineCount },
      bottomLineCount: { value: bottomLineCount },

      topLineDistance: { value: topLineDistance },
      middleLineDistance: { value: middleLineDistance },
      bottomLineDistance: { value: bottomLineDistance },

      topWavePosition: {
        value: new Vector3(topWavePosition?.x ?? 10.0, topWavePosition?.y ?? 0.5, topWavePosition?.rotate ?? -0.4)
      },
      middleWavePosition: {
        value: new Vector3(
          middleWavePosition?.x ?? 5.0,
          middleWavePosition?.y ?? 0.0,
          middleWavePosition?.rotate ?? 0.2
        )
      },
      bottomWavePosition: {
        value: new Vector3(
          bottomWavePosition?.x ?? 2.0,
          bottomWavePosition?.y ?? -0.7,
          bottomWavePosition?.rotate ?? 0.4
        )
      },

      iMouse: { value: new Vector2(-1000, -1000) },
      interactive: { value: interactive },
      bendRadius: { value: bendRadius },
      bendStrength: { value: bendStrength },
      bendInfluence: { value: 0 },

      parallax: { value: parallax },
      parallaxStrength: { value: parallaxStrength },
      parallaxOffset: { value: new Vector2(0, 0) },

      lineGradient: {
        value: Array.from({ length: MAX_GRADIENT_STOPS }, () => new Vector3(1, 1, 1))
      },
      lineGradientCount: { value: 0 }
    };

    if (linesGradient && linesGradient.length > 0) {
      const stops = linesGradient.slice(0, MAX_GRADIENT_STOPS);
      uniforms.lineGradientCount.value = stops.length;

      stops.forEach((hex, i) => {
        const color = hexToVec3(hex);
        uniforms.lineGradient.value[i].set(color.x, color.y, color.z);
      });
    }

    const material = new ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader
    });

    const geometry = new PlaneGeometry(2, 2);
    const mesh = new Mesh(geometry, material);
    scene.add(mesh);

    const clock = new Clock();

    const setSize = () => {
      const el = containerRef.current;
      const width = el.clientWidth || 1;
      const height = el.clientHeight || 1;

      renderer.setSize(width, height, false);

      const canvasWidth = renderer.domElement.width;
      const canvasHeight = renderer.domElement.height;
      uniforms.iResolution.value.set(canvasWidth, canvasHeight, 1);
    };

    setSize();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(setSize) : null;

    if (ro && containerRef.current) {
      ro.observe(containerRef.current);
    }

    const handlePointerMove = event => {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const dpr = renderer.getPixelRatio();

      targetMouseRef.current.set(x * dpr, (rect.height - y) * dpr);
      targetInfluenceRef.current = 1.0;

      if (parallax) {
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const offsetX = (x - centerX) / rect.width;
        const offsetY = -(y - centerY) / rect.height;
        targetParallaxRef.current.set(offsetX * parallaxStrength, offsetY * parallaxStrength);
      }
    };

    const handlePointerLeave = () => {
      targetInfluenceRef.current = 0.0;
    };

    const handleTouchMove = (event) => {
      if (event.touches.length > 0) {
        const touch = event.touches[0];
        handlePointerMove({ clientX: touch.clientX, clientY: touch.clientY });
      }
    };

    if (interactive) {
      renderer.domElement.addEventListener('pointermove', handlePointerMove);
      renderer.domElement.addEventListener('pointerleave', handlePointerLeave);
      renderer.domElement.addEventListener('touchmove', handleTouchMove);
      renderer.domElement.addEventListener('touchend', handlePointerLeave);
    }

    let raf = 0;
    const renderLoop = () => {
      uniforms.iTime.value = clock.getElapsedTime();

      if (interactive) {
        currentMouseRef.current.lerp(targetMouseRef.current, mouseDamping);
        uniforms.iMouse.value.copy(currentMouseRef.current);

        currentInfluenceRef.current += (targetInfluenceRef.current - currentInfluenceRef.current) * mouseDamping;
        uniforms.bendInfluence.value = currentInfluenceRef.current;
      }

      if (parallax) {
        currentParallaxRef.current.lerp(targetParallaxRef.current, mouseDamping);
        uniforms.parallaxOffset.value.copy(currentParallaxRef.current);
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    return () => {
      cancelAnimationFrame(raf);

      if (ro && containerRef.current) {
        ro.disconnect();
      }

      if (interactive) {
        renderer.domElement.removeEventListener('pointermove', handlePointerMove);
        renderer.domElement.removeEventListener('pointerleave', handlePointerLeave);
        renderer.domElement.removeEventListener('touchmove', handleTouchMove);
        renderer.domElement.removeEventListener('touchend', handlePointerLeave);
      }

      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, [
    linesGradient, enabledWaves, lineCount, lineDistance, topWavePosition,
    middleWavePosition, bottomWavePosition, animationSpeed, interactive,
    bendRadius, bendStrength, mouseDamping, parallax, parallaxStrength
  ]);

  return (
    <div
      ref={containerRef}
      className="floating-lines-container"
      style={{
        mixBlendMode: mixBlendMode,
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%'
      }}
    />
  );
}
// === END FLOATING LINES COMPONENT ===

// --- Custom Mood Form Component ---
const CustomMoodFormModal = ({ isOpen, onClose, onSave, moodToEdit }) => {
  const isEditing = !!moodToEdit;

  const [name, setName] = useState(isEditing ? moodToEdit.label : '');
  const [emoji, setEmoji] = useState(isEditing ? moodToEdit.emoji : '🌟');
  const [colorHex, setColorHex] = useState(isEditing ? moodToEdit.color_hex : '#8B5CF6');

  useEffect(() => {
    if (isEditing) {
      setName(moodToEdit.label);
      setEmoji(moodToEdit.emoji);
      setColorHex(moodToEdit.color_hex);
    } else {
      setName('');
      setEmoji('🌟');
      setColorHex('#8B5CF6');
    }
  }, [moodToEdit, isEditing]);


  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim() && emoji && colorHex) {
      const moodData = {
        label: name.trim(),
        emoji: emoji,
        color_hex: colorHex.toUpperCase(),
        is_custom: true,
      };

      if (isEditing) {
        onSave({
          ...moodData,
          id: moodToEdit.id,
          is_editing: true,
        });
      } else {
        onSave({
          ...moodData,
          id: crypto.randomUUID(),
          is_editing: false,
        });
      }
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-60 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-full sm:max-w-sm p-4 sm:p-6">
        <div className="flex justify-between items-center pb-4 border-b">
          <h3 className="text-xl font-bold text-gray-800 flex items-center">
            {isEditing ? 'แก้ไขอารมณ์กำหนดเอง' : 'สร้างอารมณ์กำหนดเอง'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl font-semibold">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ชื่ออารมณ์ (เช่น ตื่นเต้น, เหนื่อยล้า)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-indigo-500 focus:border-indigo-500"
              maxLength={20}
              placeholder="ชื่ออารมณ์"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              อิโมจิ (เช่น 🥳, 😴)
            </label>
            <input
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg p-3 text-2xl text-center focus:ring-indigo-500 focus:border-indigo-500"
              maxLength={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              สี (Hex Code)
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={colorHex}
                onChange={(e) => setColorHex(e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer p-0 border-none"
              />
              <input
                type="text"
                value={colorHex.toUpperCase()}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  if (/^#?([0-9A-F]{6})$/.test(val) || val === '#') {
                    setColorHex(val);
                  }
                }}
                required
                className="grow border border-gray-300 rounded-lg p-3 font-mono"
                placeholder="#RRGGBB"
                maxLength={7}
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full mt-6 flex items-center justify-center bg-indigo-600 text-white p-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg"
          >
            <Save size={18} className="mr-2" /> {isEditing ? 'บันทึกการแก้ไข' : 'บันทึกอารมณ์ใหม่'}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- Custom Mood Management Modal Component ---
const CustomMoodsManagementModal = ({ isOpen, onClose, customMoods, onEdit, onDelete }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-60 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-full sm:max-w-xl p-4 sm:p-6">
        <div className="flex justify-between items-center pb-4 border-b">
          <h3 className="text-xl font-bold text-gray-800 flex items-center">
            <Edit size={20} className="mr-2 text-indigo-500" /> จัดการอารมณ์กำหนดเอง ({customMoods.length})
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl font-semibold">
            <X size={24} />
          </button>
        </div>

        <div className="mt-4 space-y-3 max-h-96 overflow-y-auto pr-2">
          {customMoods.length === 0 ? (
            <p className="text-center text-gray-500 py-4">คุณยังไม่ได้สร้างอารมณ์ที่กำหนดเอง</p>
          ) : (
            customMoods.map(mood => (
              <div
                key={mood.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg shadow-sm border border-gray-200 transition-shadow hover:shadow-md"
                style={{ borderLeft: `8px solid ${mood.color_hex}`, backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
              >
                <div className="flex items-center space-x-3 mb-2 sm:mb-0">
                  <span className="text-2xl">{mood.emoji}</span>
                  <p className="font-semibold text-gray-800">{mood.label}</p>
                  <code className="text-xs font-mono text-gray-600 p-1 bg-gray-100 rounded">{mood.color_hex}</code>
                </div>
                <div className="flex space-x-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => onEdit(mood)}
                    className="flex-1 sm:flex-none flex items-center justify-center text-indigo-600 hover:text-indigo-800 p-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-colors text-sm font-medium"
                  >
                    <Edit size={16} className="mr-1" /> แก้ไข
                  </button>
                  <button
                    onClick={() => {
                      console.warn(`Deleting custom mood: ${mood.label}. All associated records in the calendar will also be removed.`);
                      onDelete(mood.id);
                    }}
                    className="flex-1 sm:flex-none flex items-center justify-center text-red-600 hover:text-red-800 p-2 rounded-lg bg-red-50 hover:bg-red-100 transition-colors text-sm font-medium"
                  >
                    <Trash2 size={16} className="mr-1" /> ลบ
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <button
          onClick={() => onEdit(null)}
          className="w-full mt-6 flex items-center justify-center bg-indigo-600 text-white p-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg"
        >
          <PlusCircle size={20} className="mr-2" /> สร้างอารมณ์ใหม่
        </button>
      </div>
    </div>
  );
};

// --- Extracted and Memoized Mood Note Editor Component ---
const MoodNoteEditor = React.memo(({
  isOpen,
  onClose,
  selectedDateKey,
  moodRecords,
  allMoods,
  onMoodSelect,
  onSaveNoteAndClose,
  onDeleteRecord,
  onOpenCustomModal,
  currentMonthIndex,
  currentYear,
  selectedDay,
}) => {
  if (!isOpen || !selectedDateKey) return null;

  // Record structure now includes 'isOkay': { mood: moodObject, note: string, isOkay: boolean | null }
  const record = moodRecords[selectedDateKey] || { mood: null, note: '', isOkay: null };
  const currentMood = record.mood;

  // Local states for the modal
  const [note, setNote] = useState(record.note || '');
  const [isOkay, setIsOkay] = useState(record.isOkay); // New state for binary status

  // Reset internal state if the date or the record in the main app changes
  useEffect(() => {
    setNote(record.note || '');
    setIsOkay(record.isOkay);
  }, [selectedDateKey, record.note, record.isOkay]);

  const isMoodRecorded = !!currentMood;
  const hasExistingNote = record.note && record.note.trim() !== '';

  const notePlaceholder = isMoodRecorded
    ? `บันทึกเกี่ยวกับอารมณ์ ${currentMood.label} ในวันนี้...`
    : 'เขียนบันทึกประจำวันของคุณที่นี่...';

  // Logic to determine if saving means deleting the whole record
  // willDelete check remains the same: it deletes ONLY if all fields are empty/null.
  const willDelete = !currentMood && note.trim() === '' && isOkay === null;

  // =================================================================
  // === NEW VALIDATION LOGIC FOR SAVE BUTTON ===
  // 1. Check if mood OR note has been entered (requires status check)
  const isMoodEntered = !!currentMood;
  const isNoteEntered = note.trim() !== '';
  const isDataEntered = isMoodEntered || isNoteEntered || isOkay !== null;

  // 2. Check if the required binary status is missing (only if data is present)
  // We require isOkay to be explicitly true or false if there is ANY data entered.
  const isStatusMissing = isDataEntered && isOkay === null;

  // 3. New final disabled condition for the save button: 
  //    Disabled if: (1) should delete (nothing entered) OR (2) data entered but status missing
  const isSaveDisabled = willDelete || isStatusMissing;
  // =================================================================


  // Handler uses the internal 'note' and 'isOkay' state and passes it to the parent handler
  const handleSaveNote = () => {
    // Only proceed to save if the button is NOT disabled (validation passed)
    if (!isSaveDisabled) {
      onSaveNoteAndClose(currentMood, note.trim(), isOkay);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-full sm:max-w-2xl p-4 sm:p-6 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b">
          <h3 className="text-xl font-bold text-gray-800">
            {currentMood ? `บันทึกสำหรับวันที่ ${selectedDay}` : `เลือกอารมณ์และบันทึก: ${selectedDay}`} {MONTHS[currentMonthIndex]} {currentYear}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl font-semibold">
            <X size={24} />
          </button>
        </div>

        {/* === 1. Mood Selection Grid === */}
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-gray-600 mb-2 flex items-center">
            <span className="w-2 h-2 rounded-full bg-indigo-500 mr-2 animate-pulse"></span>
            1. เลือกอารมณ์หลัก: {currentMood ? (
              <span className="text-lg font-bold ml-2" style={currentMood.color_hex ? { color: currentMood.color_hex } : {}}>
                {currentMood.emoji} {currentMood.label}
              </span>
            ) : <span className="text-lg font-bold ml-2 text-gray-500">ยังไม่เลือก</span>}
          </h4>
          <div className="max-h-40 overflow-y-auto border-b pb-2 -mx-2 px-2">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {allMoods.map(moodItem => {
                const isSelected = currentMood?.id === moodItem.id;
                const isCustom = moodItem.is_custom;
                const moodClass = isCustom ? 'bg-gray-700' : moodItem.color_tailwind;
                const moodStyle = isCustom && moodItem.color_hex ? { backgroundColor: moodItem.color_hex } : {};

                return (
                  <button
                    key={moodItem.id}
                    onClick={() => onMoodSelect(moodItem)}
                    className={`p-3 rounded-xl flex flex-col items-center justify-center transition-all shadow-md text-white font-semibold 
                    ${!isCustom ? moodClass : ''}
                    ${isSelected ? 'scale-105 sm:scale-110 ring-4 ring-offset-2 ring-indigo-500/70' : 'hover:scale-105'}
                  `}
                    style={moodStyle}
                  >
                    <span className="text-2xl sm:text-3xl mb-1">{moodItem.emoji}</span>
                    <span className="text-xs sm:text-sm">{moodItem.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* === 2. Note Editor (Textarea Styled as Rich Editor) === */}
        <div className="mt-4 grow flex flex-col">
          <h4 className="text-sm font-semibold text-gray-600 mb-2 flex items-center">
            <BookOpen size={16} className="text-indigo-500 mr-2" />
            2. บันทึก/โน้ตประจำวัน (ไม่เกิน 500 ตัวอักษร)
          </h4>
          <textarea
            value={note} // Use local state 'note'
            onChange={(e) => {
              setNote(e.target.value);
            }}
            placeholder={notePlaceholder}
            maxLength={500}
            className="grow w-full border border-gray-300 rounded-xl p-4 resize-none focus:ring-indigo-500 focus:border-indigo-500 shadow-inner bg-gray-50/70 text-gray-800 text-base font-serif leading-relaxed transition-shadow"
            style={{ minHeight: '150px' }}
            autoFocus
          />
          <div className="text-right text-xs text-gray-500 mt-1">
            {note.length} / 500 ตัวอักษร
          </div>
        </div>

        {/* === 3. Binary Status Tracker (NEW FEATURE) - REMOVED CLEAR BUTTON === */}
        <div className="mt-4 pt-4 border-t flex flex-col">
          <h4 className="text-sm font-semibold text-gray-600 mb-3 flex items-center">
            <span className="w-2 h-2 rounded-full bg-pink-500 mr-2 animate-pulse"></span>
            3. วันนี้โอเคไหม? (สถานะโดยรวม)
          </h4>

          {/* Removed the third button for setIsOkay(null) */}
          <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:space-x-4">
            <button
              onClick={() => setIsOkay(true)}
              className={`flex-1 flex items-center justify-center p-3 sm:p-4 rounded-xl font-bold text-lg transition-all shadow-lg 
                        ${isOkay === true
                  ? 'bg-green-600 text-white scale-105 ring-4 ring-green-500/50'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
            >
              โอเค 👌
            </button>
            <button
              onClick={() => setIsOkay(false)}
              className={`flex-1 flex items-center justify-center p-3 sm:p-4 rounded-xl font-bold text-lg transition-all shadow-lg 
                        ${isOkay === false
                  ? 'bg-red-600 text-white scale-105 ring-4 ring-red-500/50'
                  : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
            >
              ไม่โอเค 😞
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-2 text-center">
            สถานะปัจจุบัน:
            {isOkay === true && <span className="text-green-600 font-bold ml-1">โอเค</span>}
            {isOkay === false && <span className="text-red-600 font-bold ml-1">ไม่โอเค</span>}
            {isOkay === null && <span className="text-gray-500 font-bold ml-1">ยังไม่เลือก (โปรดเลือกเพื่อบันทึกสถานะ)</span>}
          </p>
        </div>


        {/* === 4. Action Buttons / Footer (Quick Access Button Removed) === */}
        <div className="mt-6 pt-4 border-t flex justify-between items-center flex-wrap gap-3">

          <button
            onClick={onDeleteRecord}
            // Check if any data exists: mood OR note OR status
            disabled={!isMoodRecorded && !hasExistingNote && isOkay === null}
            className={`flex items-center text-sm font-medium p-2 rounded-lg transition-colors 
                  ${isMoodRecorded || hasExistingNote || isOkay !== null
                ? 'text-red-600 hover:bg-red-50'
                : 'text-gray-400 cursor-not-allowed'
              }`}
          >
            <Trash2 size={16} className="mr-1" /> ลบข้อมูลทั้งหมด
          </button>

          <button
            onClick={handleSaveNote}
            // ใช้เงื่อนไข isSaveDisabled ที่คำนวณไว้ใหม่
            disabled={isSaveDisabled}
            className={`flex items-center text-white p-3 rounded-lg font-bold transition-colors shadow-lg
                  ${isSaveDisabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}
              `}
          >
            <Save size={18} className="mr-2" />
            {willDelete
              ? 'ยกเลิก (ไม่มีข้อมูล)'
              : isStatusMissing
                ? 'เลือกสถานะก่อนบันทึก' // ข้อความเมื่อข้อมูลครบแต่ขาดสถานะ
                : 'บันทึกบันทึกและปิด'
            }
          </button>
        </div>
      </div>
    </div>
  );
});

// === MAIN COMPONENT ===
function App() {
  const today = new Date();
  const [currentMonthIndex, setCurrentMonthIndex] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [isManagementModalOpen, setIsManagementModalOpen] = useState(false);
  const [moodToEdit, setMoodToEdit] = useState(null);

  // moodRecords stores { dateKey: { mood: moodObject, note: string, isOkay: boolean | null } }
  const [moodRecords, setMoodRecords] = useState({});
  const [customMoods, setCustomMoods] = useState([]);

  const selectedDateKey = selectedDay
    ? `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    : null;

  // --- Helper: รวมอารมณ์ทั้งหมด ---
  const allMoods = [...DEFAULT_MOODS, ...customMoods];

  // --- Handlers สำหรับ localStorage ---
  // Note: We use localStorage for simplicity, but for a real app, Firestore should be used.
  useEffect(() => {
    const savedMoods = JSON.parse(localStorage.getItem('moodRecords')) || {};
    const savedCustoms = JSON.parse(localStorage.getItem('customMoods')) || [];
    setMoodRecords(savedMoods);
    setCustomMoods(savedCustoms);
  }, []);

  useEffect(() => {
    localStorage.setItem('moodRecords', JSON.stringify(moodRecords));
  }, [moodRecords]);

  useEffect(() => {
    localStorage.setItem('customMoods', JSON.stringify(customMoods));
  }, [customMoods]);

  // --- Handlers ปฏิทิน ---
  const handleMonthChange = (direction) => {
    let newMonth = currentMonthIndex + direction;
    let newYear = currentYear;
    if (newMonth < 0) {
      newMonth = 11; newYear -= 1;
    } else if (newMonth > 11) {
      newMonth = 0; newYear += 1;
    }
    setCurrentMonthIndex(newMonth);
    setCurrentYear(newYear);
    setSelectedDay(null);
  };

  const handleYearChange = (event) => {
    setCurrentYear(parseInt(event.target.value));
    setSelectedDay(null);
  };

  const handleDayClick = (day) => {
    if (day !== null) {
      setSelectedDay(day);
      setIsModalOpen(true);
    }
  };

  // --- Handler สำหรับเลือกอารมณ์ (อัปเดตทันที) ---
  const handleMoodSelect = (mood) => {
    if (selectedDateKey) {
      const currentRecord = moodRecords[selectedDateKey] || { mood: null, note: '', isOkay: null };
      setMoodRecords(prev => ({
        ...prev,
        [selectedDateKey]: { ...currentRecord, mood: mood },
      }));
    }
  };

  // --- Handler สำหรับบันทึกโน้ต (รับค่า Note และ isOkay จาก Modal) ---
  const handleSaveNoteAndClose = (mood, note, isOkay) => {
    if (selectedDateKey) {
      const trimmedNote = note;

      // Check if there is any data to save (mood OR note OR status)
      if (mood || trimmedNote || isOkay !== null) {
        setMoodRecords(prev => ({
          ...prev,
          [selectedDateKey]: { mood: mood, note: trimmedNote, isOkay: isOkay },
        }));
      }

      // If no data exists, delete the record
      if (!mood && !trimmedNote && isOkay === null) {
        handleDeleteRecord();
      }
    }
    setIsModalOpen(false);
  };

  // --- Handler สำหรับลบข้อมูลทั้งหมด (Mood, Note & Status) ---
  const handleDeleteRecord = () => {
    if (selectedDateKey) {
      const newRecords = { ...moodRecords };
      delete newRecords[selectedDateKey];
      setMoodRecords(newRecords);
      setIsModalOpen(false);
    }
  };

  // --- Handler สำหรับบันทึก Custom Mood (รองรับการแก้ไข) ---
  const handleSaveCustomMood = (newMood) => {
    if (newMood.is_editing) {
      setCustomMoods(prev => prev.map(m =>
        m.id === newMood.id ? { ...m, label: newMood.label, emoji: newMood.emoji, color_hex: newMood.color_hex, is_custom: true } : m
      ));
      setMoodToEdit(null);
      setIsManagementModalOpen(true);
    } else {
      const isDuplicate = allMoods.some(mood => mood.label.toLowerCase() === newMood.label.toLowerCase());

      if (isDuplicate) {
        console.error("ชื่ออารมณ์ซ้ำ! โปรดใช้ชื่ออื่น");
        return;
      }
      setCustomMoods(prev => [...prev, newMood]);
    }
  };

  // --- Handler สำหรับลบ Custom Mood ---
  const handleDeleteCustomMood = (moodId) => {
    setCustomMoods(prev => prev.filter(mood => mood.id !== moodId));

    // ลบ Mood Records ที่ใช้ Mood ID นั้นๆ
    setMoodRecords(prevRecords => {
      const newRecords = {};
      for (const key in prevRecords) {
        if (prevRecords[key].mood?.id !== moodId) {
          newRecords[key] = prevRecords[key];
        } else {
          console.log(`Mood record for ${key} was deleted because the custom mood was removed.`);
        }
      }
      return newRecords;
    });
  };

  const handleEditCustomMoodClick = (mood) => {
    setMoodToEdit(mood);
    setIsManagementModalOpen(false);
    setIsCustomModalOpen(true);
  };

  // --- Render Calendar ---
  const calendarDays = getCalendarData(currentYear, currentMonthIndex);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 antialiased overflow-hidden bg-gray-900">
      {/* === Dynamic Background Layer (FIX: Conditionally render based on modal state) === */}
      <div className="fixed inset-0 w-full h-full z-10">
        {!isModalOpen && !isCustomModalOpen && !isManagementModalOpen && (
          <FloatingLines
            enabledWaves={['top', 'middle', 'bottom']}
            lineCount={[10, 15, 20]}
            lineDistance={[8, 6, 4]}
            animationSpeed={0.5}
            parallaxStrength={0.05}
            interactive={true}
            linesGradient={['#FF0077', '#00FFFF', '#8B00FF']}
            mixBlendMode="lighten"
          />
        )}
      </div>

      {/* === Calendar Content Layer === */}
      <div className="relative z-20 w-full max-w-lg sm:max-w-xl">
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-2xl p-4 sm:p-6 w-full transition-all duration-300">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-center text-indigo-700 mb-6 flex items-center justify-center">
            <span className="mr-2">Moodfolio</span> 🗓️
          </h1>

          {/* === ส่วนควบคุม เดือน/ปี === */}
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <button onClick={() => handleMonthChange(-1)} className="p-2 rounded-full text-indigo-600 hover:bg-indigo-100 transition-colors">
              <ChevronLeft size={24} />
            </button>

            <div className="flex items-center space-x-3">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                {MONTHS[currentMonthIndex]}
              </h2>
              <select
                value={currentYear}
                onChange={handleYearChange}
                className="border border-gray-300 rounded-lg py-2 px-3 text-base sm:text-lg font-medium focus:ring-indigo-500 focus:border-indigo-500 bg-white/70"
              >
                {[...Array(11)].map((_, i) => {
                  const yearOption = today.getFullYear() - 5 + i;
                  return (<option key={yearOption} value={yearOption}>{yearOption}</option>);
                })}
              </select>
            </div>

            <button onClick={() => handleMonthChange(1)} className="p-2 rounded-full text-indigo-600 hover:bg-indigo-100 transition-colors">
              <ChevronRight size={24} />
            </button>
          </div>

          {/* === ส่วนแสดงปฏิทิน === */}
          <div className="grid grid-cols-7 text-center text-xs sm:text-sm font-semibold text-gray-600 mb-2">
            {WEEKDAYS.map(day => (<div key={day} className="p-1 sm:p-2">{day}</div>))}
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {calendarDays.map((day, index) => {
              const dateKey = day ? `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
              const record = moodRecords[dateKey];
              const isToday = day === today.getDate() && currentMonthIndex === today.getMonth() && currentYear === today.getFullYear();

              const isMoodRecorded = !!record?.mood;
              const isCustom = record?.mood?.is_custom === true;
              const hasNote = record?.note && record.note.trim() !== '';
              const isOkayStatus = record?.isOkay; // true, false, or null

              const moodClass = record?.mood?.color_tailwind || '';
              const moodStyle = isCustom && record?.mood?.color_hex ? { backgroundColor: record.mood.color_hex } : {};

              // 1. Determine the border color based on the explicit status request
              const isStatusRecorded = isOkayStatus !== null;
              let borderClass = 'border-transparent';

              if (isOkayStatus === true) {
                // Green border for 'OK'
                borderClass = 'border-green-500 ring-2 ring-green-500/50';
              } else if (isOkayStatus === false) {
                // Red border for 'NOT OK'
                borderClass = 'border-red-500 ring-2 ring-red-500/50';
              } else if (isMoodRecorded) {
                // If no status, but mood exists, show a subtle white border
                borderClass = 'border-white/50';
              } else if (isToday) {
                // If no status, no mood, but it's today, use indigo
                borderClass = 'border-indigo-500';
              }

              const baseBgClass = isToday && !isMoodRecorded && !isStatusRecorded
                ? 'bg-indigo-100 text-indigo-700 font-bold'
                : 'text-gray-900 hover:bg-indigo-50';

              const moodBgClass = isMoodRecorded
                ? `text-white font-bold transform scale-105 shadow-md ${!isCustom ? moodClass : ''}`
                : '';

              return (
                <div key={index} className="aspect-square">
                  {day !== null ? (
                    <button
                      onClick={() => handleDayClick(day)}
                      className={`
                        w-full h-full flex items-center justify-center rounded-lg relative
                        font-medium text-base sm:text-lg transition-all duration-150 border-2
                        ${baseBgClass}
                        ${moodBgClass}
                        ${borderClass}
                      `}
                      style={moodStyle}
                    >
                      {day}
                      {isMoodRecorded && (
                        <span className="absolute bottom-1 right-1 text-xs sm:text-sm leading-none">{record.mood.emoji}</span>
                      )}
                      {hasNote && (
                        <div className="absolute top-1 left-1 w-2 h-2 bg-purple-400 rounded-full shadow-lg" title="มีบันทึก"></div>
                      )}
                    </button>
                  ) : (
                    <div className="w-full h-full"></div>
                  )}
                </div>
              );
            })}
          </div>

          {/* === ปุ่มเปิด Modal จัดการอารมณ์ === */}
          <div className="w-full max-w-xl flex justify-end mt-4">
            <button
              onClick={() => setIsManagementModalOpen(true)}
              className="flex items-center text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg font-medium transition-colors border border-transparent hover:border-indigo-200 text-sm sm:text-base"
            >
              <Edit size={18} className="mr-2" /> จัดการอารมณ์กำหนดเอง
            </button>
          </div>
        </div>
      </div>

      {/* === Modal Overlay สำหรับเลือกอารมณ์และบันทึกโน้ต (ใช้คอมโพเนนต์ที่ดึงออกมา) === */}
      <MoodNoteEditor
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedDateKey={selectedDateKey}
        moodRecords={moodRecords}
        allMoods={allMoods}
        onMoodSelect={handleMoodSelect}
        onSaveNoteAndClose={handleSaveNoteAndClose}
        onDeleteRecord={handleDeleteRecord}
        onOpenCustomModal={() => {
          setIsModalOpen(false);
          setMoodToEdit(null);
          setIsCustomModalOpen(true);
        }}
        currentMonthIndex={currentMonthIndex}
        currentYear={currentYear}
        selectedDay={selectedDay}
      />

      {/* === Modal สำหรับจัดการ Custom Moods (Management) === */}
      <CustomMoodsManagementModal
        isOpen={isManagementModalOpen}
        onClose={() => setIsManagementModalOpen(false)}
        customMoods={customMoods}
        onEdit={handleEditCustomMoodClick}
        onDelete={handleDeleteCustomMood}
      />

      {/* === Modal สำหรับสร้าง/แก้ไข Custom Moods (Form) === */}
      <CustomMoodFormModal
        isOpen={isCustomModalOpen}
        onClose={() => {
          setIsCustomModalOpen(false);
          setMoodToEdit(null);
          if (isManagementModalOpen) setIsManagementModalOpen(true);
        }}
        onSave={handleSaveCustomMood}
        moodToEdit={moodToEdit}
      />
    </div>
  );
}

export default App;