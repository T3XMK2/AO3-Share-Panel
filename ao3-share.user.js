// ==UserScript==
// @name         AO3 Share Panel
// @namespace    https://archiveofourown.org/
// @version      2.1.1
// @description  Professional sharing panel for AO3 works: Generate QR codes, shareable cards, and formatted text with customizable options
// @author       AO3 Share Panel Contributors
// @match        https://archiveofourown.org/works/*
// @match        https://archiveofourown.org/chapters/*
// @icon         https://archiveofourown.org/favicon.ico
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/T3XMK2/AO3-Share-Panel/main/ao3-share.user.js
// @downloadURL  https://raw.githubusercontent.com/T3XMK2/AO3-Share-Panel/main/ao3-share.user.js
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  // ============================================================
  // CONFIGURATION
  // ============================================================
  const CONFIG = {
    BUTTON_POSITION: { bottom: '24px', right: '24px' },
    CARD_DIMENSIONS: { width: 440, height: 660 },
    QR_SIZE: 170,
    ANIMATION_DURATION: 220,

    MAX_TAGS_DISPLAY: 5,
    MAX_SUMMARY_LENGTH: 220,

    CARD_SHOW_SUMMARY_MAX_CHARS: 220,
    CARD_SHOW_TAGS_MAX: 4,

    COLORS: {
      ao3Red: '#990000',
      ao3RedDark: '#660000',
      panelBg: '#ffffff',
      border: '#dcdcdc',
      text: '#222',
      muted: '#666',
      subtle: '#f2f2f2'
    }
  };

  // Prevent accidental mutation of configuration values at runtime
  Object.freeze(CONFIG.BUTTON_POSITION);
  Object.freeze(CONFIG.CARD_DIMENSIONS);
  Object.freeze(CONFIG.COLORS);
  Object.freeze(CONFIG);

  // ============================================================
  // STORAGE UTILITIES
  // Handles persistent storage with GM_* API and localStorage fallback
  // ============================================================
  const Storage = {
    /**
     * Retrieve a value from storage
     * @param {string} key - Storage key
     * @param {*} defaultValue - Default value if key doesn't exist
     * @returns {*} Stored value or default
     */
    get(key, defaultValue = null) {
      try {
        if (typeof GM_getValue !== 'undefined') {
          return GM_getValue(key, defaultValue);
        }
      } catch (error) {
        console.warn('[AO3 Share] GM_getValue failed, using localStorage:', error);
      }
      
      try {
        const stored = localStorage.getItem(`ao3share_${key}`);
        return stored !== null ? JSON.parse(stored) : defaultValue;
      } catch (error) {
        console.error('[AO3 Share] Storage get failed:', error);
        return defaultValue;
      }
    },

    /**
     * Store a value
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     */
    set(key, value) {
      try {
        if (typeof GM_setValue !== 'undefined') {
          GM_setValue(key, value);
          return;
        }
      } catch (error) {
        console.warn('[AO3 Share] GM_setValue failed, using localStorage:', error);
      }
      
      try {
        localStorage.setItem(`ao3share_${key}`, JSON.stringify(value));
      } catch (error) {
        console.error('[AO3 Share] Storage set failed:', error);
      }
    }
  };

  // ============================================================
  // QR CODE GENERATOR (Embedded - No external dependencies)
  // Based on QRCode.js by Kazuhiko Arase (MIT License)
  // ============================================================
  const QRCode = (function () {
    const PAD0 = 0xEC, PAD1 = 0x11;
    const QRMode = { MODE_NUMBER: 1, MODE_ALPHA_NUM: 2, MODE_8BIT_BYTE: 4 };
    const QRErrorCorrectLevel = { L: 1, M: 0, Q: 3, H: 2 };
    const QRMaskPattern = {
      PATTERN000: 0, PATTERN001: 1, PATTERN010: 2, PATTERN011: 3,
      PATTERN100: 4, PATTERN101: 5, PATTERN110: 6, PATTERN111: 7
    };

    const QRUtil = {
      PATTERN_POSITION_TABLE: [
        [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
        [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54],
        [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70],
        [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86],
        [6, 34, 62, 90], [6, 28, 50, 72, 94], [6, 26, 50, 74, 98],
        [6, 30, 54, 78, 102], [6, 28, 54, 80, 106], [6, 32, 58, 84, 110],
        [6, 30, 58, 86, 114], [6, 34, 62, 90, 118], [6, 26, 50, 74, 98, 122],
        [6, 30, 54, 78, 102, 126], [6, 26, 52, 78, 104, 130],
        [6, 30, 56, 82, 108, 134], [6, 34, 60, 86, 112, 138],
        [6, 30, 58, 86, 114, 142], [6, 34, 62, 90, 118, 146],
        [6, 30, 54, 78, 102, 126, 150], [6, 24, 50, 76, 102, 128, 154],
        [6, 28, 54, 80, 106, 132, 158], [6, 32, 58, 84, 110, 136, 162],
        [6, 26, 54, 82, 110, 138, 166], [6, 30, 58, 86, 114, 142, 170]
      ],
      G15: (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0),
      G18: (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0),
      G15_MASK: (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1),

      getBCHTypeInfo(data) {
        let d = data << 10;
        while (this.getBCHDigit(d) - this.getBCHDigit(this.G15) >= 0) {
          d ^= (this.G15 << (this.getBCHDigit(d) - this.getBCHDigit(this.G15)));
        }
        return ((data << 10) | d) ^ this.G15_MASK;
      },

      getBCHTypeNumber(data) {
        let d = data << 12;
        while (this.getBCHDigit(d) - this.getBCHDigit(this.G18) >= 0) {
          d ^= (this.G18 << (this.getBCHDigit(d) - this.getBCHDigit(this.G18)));
        }
        return (data << 12) | d;
      },

      getBCHDigit(data) {
        let digit = 0;
        while (data !== 0) { digit++; data >>>= 1; }
        return digit;
      },

      getPatternPosition(typeNumber) { return this.PATTERN_POSITION_TABLE[typeNumber - 1]; },

      getMask(maskPattern, i, j) {
        switch (maskPattern) {
          case QRMaskPattern.PATTERN000: return (i + j) % 2 === 0;
          case QRMaskPattern.PATTERN001: return i % 2 === 0;
          case QRMaskPattern.PATTERN010: return j % 3 === 0;
          case QRMaskPattern.PATTERN011: return (i + j) % 3 === 0;
          case QRMaskPattern.PATTERN100: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
          case QRMaskPattern.PATTERN101: return (i * j) % 2 + (i * j) % 3 === 0;
          case QRMaskPattern.PATTERN110: return ((i * j) % 2 + (i * j) % 3) % 2 === 0;
          case QRMaskPattern.PATTERN111: return ((i * j) % 3 + (i + j) % 2) % 2 === 0;
          default: throw new Error('Invalid mask pattern');
        }
      },

      getErrorCorrectPolynomial(errorCorrectLength) {
        let a = new QRPolynomial([1], 0);
        for (let i = 0; i < errorCorrectLength; i++) {
          a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0));
        }
        return a;
      },

      getLengthInBits(mode, type) {
        if (1 <= type && type < 10) {
          switch (mode) {
            case QRMode.MODE_NUMBER: return 10;
            case QRMode.MODE_ALPHA_NUM: return 9;
            case QRMode.MODE_8BIT_BYTE: return 8;
            default: throw new Error('Invalid mode');
          }
        } else if (type < 27) {
          switch (mode) {
            case QRMode.MODE_NUMBER: return 12;
            case QRMode.MODE_ALPHA_NUM: return 11;
            case QRMode.MODE_8BIT_BYTE: return 16;
            default: throw new Error('Invalid mode');
          }
        } else if (type < 41) {
          switch (mode) {
            case QRMode.MODE_NUMBER: return 14;
            case QRMode.MODE_ALPHA_NUM: return 13;
            case QRMode.MODE_8BIT_BYTE: return 16;
            default: throw new Error('Invalid mode');
          }
        } else {
          throw new Error('Invalid type');
        }
      },

      getLostPoint(qrCode) {
        const moduleCount = qrCode.getModuleCount();
        let lostPoint = 0;

        for (let row = 0; row < moduleCount; row++) {
          for (let col = 0; col < moduleCount; col++) {
            let sameCount = 0;
            const dark = qrCode.isDark(row, col);
            for (let r = -1; r <= 1; r++) {
              if (row + r < 0 || moduleCount <= row + r) continue;
              for (let c = -1; c <= 1; c++) {
                if (col + c < 0 || moduleCount <= col + c) continue;
                if (r === 0 && c === 0) continue;
                if (dark === qrCode.isDark(row + r, col + c)) sameCount++;
              }
            }
            if (sameCount > 5) lostPoint += (3 + sameCount - 5);
          }
        }

        for (let row = 0; row < moduleCount - 1; row++) {
          for (let col = 0; col < moduleCount - 1; col++) {
            let count = 0;
            if (qrCode.isDark(row, col)) count++;
            if (qrCode.isDark(row + 1, col)) count++;
            if (qrCode.isDark(row, col + 1)) count++;
            if (qrCode.isDark(row + 1, col + 1)) count++;
            if (count === 0 || count === 4) lostPoint += 3;
          }
        }

        for (let row = 0; row < moduleCount; row++) {
          for (let col = 0; col < moduleCount - 6; col++) {
            if (qrCode.isDark(row, col) &&
              !qrCode.isDark(row, col + 1) &&
              qrCode.isDark(row, col + 2) &&
              qrCode.isDark(row, col + 3) &&
              qrCode.isDark(row, col + 4) &&
              !qrCode.isDark(row, col + 5) &&
              qrCode.isDark(row, col + 6)) lostPoint += 40;
          }
        }

        for (let col = 0; col < moduleCount; col++) {
          for (let row = 0; row < moduleCount - 6; row++) {
            if (qrCode.isDark(row, col) &&
              !qrCode.isDark(row + 1, col) &&
              qrCode.isDark(row + 2, col) &&
              qrCode.isDark(row + 3, col) &&
              qrCode.isDark(row + 4, col) &&
              !qrCode.isDark(row + 5, col) &&
              qrCode.isDark(row + 6, col)) lostPoint += 40;
          }
        }

        let darkCount = 0;
        for (let col = 0; col < moduleCount; col++) {
          for (let row = 0; row < moduleCount; row++) if (qrCode.isDark(row, col)) darkCount++;
        }

        const ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
        lostPoint += ratio * 10;
        return lostPoint;
      }
    };

    const QRMath = {
      glog(n) {
        if (n < 1) throw new Error('glog(' + n + ')');
        return this.LOG_TABLE[n];
      },
      gexp(n) {
        while (n < 0) n += 255;
        while (n >= 256) n -= 255;
        return this.EXP_TABLE[n];
      },
      EXP_TABLE: new Array(256),
      LOG_TABLE: new Array(256)
    };

    (function () {
      for (let i = 0; i < 8; i++) QRMath.EXP_TABLE[i] = 1 << i;
      for (let i = 8; i < 256; i++) {
        QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4] ^
          QRMath.EXP_TABLE[i - 5] ^
          QRMath.EXP_TABLE[i - 6] ^
          QRMath.EXP_TABLE[i - 8];
      }
      for (let i = 0; i < 255; i++) QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;
    })();

    function QRPolynomial(num, shift) {
      let offset = 0;
      while (offset < num.length && num[offset] === 0) offset++;
      this.num = new Array(num.length - offset + shift);
      for (let i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset];
    }

    QRPolynomial.prototype = {
      get(index) { return this.num[index]; },
      getLength() { return this.num.length; },
      multiply(e) {
        const num = new Array(this.getLength() + e.getLength() - 1);
        for (let i = 0; i < this.getLength(); i++) {
          for (let j = 0; j < e.getLength(); j++) {
            num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
          }
        }
        return new QRPolynomial(num, 0);
      },
      mod(e) {
        if (this.getLength() - e.getLength() < 0) return this;
        const ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
        const num = new Array(this.getLength());
        for (let i = 0; i < this.getLength(); i++) num[i] = this.get(i);
        for (let i = 0; i < e.getLength(); i++) num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
        return new QRPolynomial(num, 0).mod(e);
      }
    };

    function QRRSBlock(totalCount, dataCount) { this.totalCount = totalCount; this.dataCount = dataCount; }

    // Cached in window to avoid re-alloc for multi page nav
    QRRSBlock.RS_BLOCK_TABLE = window.__AO3SP_RS_BLOCK_TABLE__ || (window.__AO3SP_RS_BLOCK_TABLE__ = [
      [1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9],
      [1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16],
      [1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13],
      [1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9],
      [1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12],
      [2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15],
      [2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14],
      [2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15],
      [2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13],
      [2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16],
      [4, 101, 81], [1, 80, 50, 4, 81, 51], [4, 50, 22, 4, 51, 23], [3, 36, 12, 8, 37, 13],
      [2, 116, 92, 2, 117, 93], [6, 58, 36, 2, 59, 37], [4, 46, 20, 6, 47, 21], [7, 42, 14, 4, 43, 15],
      [4, 133, 107], [8, 59, 37, 1, 60, 38], [8, 44, 20, 4, 45, 21], [12, 33, 11, 4, 34, 12],
      [3, 145, 115, 1, 146, 116], [4, 64, 40, 5, 65, 41], [11, 36, 16, 5, 37, 17], [11, 36, 12, 5, 37, 13],
      [5, 109, 87, 1, 110, 88], [5, 65, 41, 5, 66, 42], [5, 54, 24, 7, 55, 25], [11, 36, 12, 7, 37, 13],
      [5, 122, 98, 1, 123, 99], [7, 73, 45, 3, 74, 46], [15, 43, 19, 2, 44, 20], [3, 45, 15, 13, 46, 16],
      [1, 135, 107, 5, 136, 108], [10, 74, 46, 1, 75, 47], [1, 50, 22, 15, 51, 23], [2, 42, 14, 17, 43, 15],
      [5, 150, 120, 1, 151, 121], [9, 69, 43, 4, 70, 44], [17, 50, 22, 1, 51, 23], [2, 42, 14, 19, 43, 15],
      [3, 141, 113, 4, 142, 114], [3, 70, 44, 11, 71, 45], [17, 47, 21, 4, 48, 22], [9, 39, 13, 16, 40, 14],
      [3, 135, 107, 5, 136, 108], [3, 67, 41, 13, 68, 42], [15, 54, 24, 5, 55, 25], [15, 43, 15, 10, 44, 16],
      [4, 144, 116, 4, 145, 117], [17, 68, 42], [17, 50, 22, 6, 51, 23], [19, 46, 16, 6, 47, 17],
      [2, 139, 111, 7, 140, 112], [17, 74, 46], [7, 54, 24, 16, 55, 25], [34, 37, 13],
      [4, 151, 121, 5, 152, 122], [4, 75, 47, 14, 76, 48], [11, 54, 24, 14, 55, 25], [16, 45, 15, 14, 46, 16],
      [6, 147, 117, 4, 148, 118], [6, 73, 45, 14, 74, 46], [11, 54, 24, 16, 55, 25], [30, 46, 16, 2, 47, 17],
      [8, 132, 106, 4, 133, 107], [8, 75, 47, 13, 76, 48], [7, 54, 24, 22, 55, 25], [22, 45, 15, 13, 46, 16],
      [10, 142, 114, 2, 143, 115], [19, 74, 46, 4, 75, 47], [28, 50, 22, 6, 51, 23], [33, 46, 16, 4, 47, 17],
      [8, 152, 122, 4, 153, 123], [22, 73, 45, 3, 74, 46], [8, 53, 23, 26, 54, 24], [12, 45, 15, 28, 46, 16],
      [3, 147, 117, 10, 148, 118], [3, 73, 45, 23, 74, 46], [4, 54, 24, 31, 55, 25], [11, 45, 15, 31, 46, 16],
      [7, 146, 116, 7, 147, 117], [21, 73, 45, 7, 74, 46], [1, 53, 23, 37, 54, 24], [19, 45, 15, 26, 46, 16],
      [5, 145, 115, 10, 146, 116], [19, 75, 47, 10, 76, 48], [15, 54, 24, 25, 55, 25], [23, 45, 15, 25, 46, 16],
      [13, 145, 115, 3, 146, 116], [2, 74, 46, 29, 75, 47], [42, 54, 24, 1, 55, 25], [23, 45, 15, 28, 46, 16],
      [17, 145, 115], [10, 74, 46, 23, 75, 47], [10, 54, 24, 35, 55, 25], [19, 45, 15, 35, 46, 16],
      [17, 145, 115, 1, 146, 116], [14, 74, 46, 21, 75, 47], [29, 54, 24, 19, 55, 25], [11, 45, 15, 46, 46, 16],
      [13, 145, 115, 6, 146, 116], [14, 74, 46, 23, 75, 47], [44, 54, 24, 7, 55, 25], [59, 46, 16, 1, 47, 17],
      [12, 151, 121, 7, 152, 122], [12, 75, 47, 26, 76, 48], [39, 54, 24, 14, 55, 25], [22, 45, 15, 41, 46, 16],
      [6, 151, 121, 14, 152, 122], [6, 75, 47, 34, 76, 48], [46, 54, 24, 10, 55, 25], [2, 45, 15, 64, 46, 16],
      [17, 152, 122, 4, 153, 123], [29, 74, 46, 14, 75, 47], [49, 54, 24, 10, 55, 25], [24, 45, 15, 46, 46, 16],
      [4, 152, 122, 18, 153, 123], [13, 74, 46, 32, 75, 47], [48, 54, 24, 14, 55, 25], [42, 45, 15, 32, 46, 16],
      [20, 147, 117, 4, 148, 118], [40, 75, 47, 7, 76, 48], [43, 54, 24, 22, 55, 25], [10, 45, 15, 67, 46, 16],
      [19, 148, 118, 6, 149, 119], [18, 75, 47, 31, 76, 48], [34, 54, 24, 34, 55, 25], [20, 45, 15, 61, 46, 16]
    ]);

    QRRSBlock.getRSBlocks = function (typeNumber, errorCorrectLevel) {
      const rsBlock = this.getRsBlockTable(typeNumber, errorCorrectLevel);
      if (rsBlock === undefined) throw new Error('Invalid RS Block');
      const length = rsBlock.length / 3;
      const list = [];
      for (let i = 0; i < length; i++) {
        const count = rsBlock[i * 3 + 0];
        const totalCount = rsBlock[i * 3 + 1];
        const dataCount = rsBlock[i * 3 + 2];
        for (let j = 0; j < count; j++) list.push(new QRRSBlock(totalCount, dataCount));
      }
      return list;
    };

    QRRSBlock.getRsBlockTable = function (typeNumber, errorCorrectLevel) {
      const idx = (typeNumber - 1) * 4;
      switch (errorCorrectLevel) {
        case QRErrorCorrectLevel.L: return this.RS_BLOCK_TABLE[idx + 0];
        case QRErrorCorrectLevel.M: return this.RS_BLOCK_TABLE[idx + 1];
        case QRErrorCorrectLevel.Q: return this.RS_BLOCK_TABLE[idx + 2];
        case QRErrorCorrectLevel.H: return this.RS_BLOCK_TABLE[idx + 3];
        default: return undefined;
      }
    };

    function QRBitBuffer() { this.buffer = []; this.length = 0; }
    QRBitBuffer.prototype = {
      put(num, length) { for (let i = 0; i < length; i++) this.putBit(((num >>> (length - i - 1)) & 1) === 1); },
      getLengthInBits() { return this.length; },
      putBit(bit) {
        const bufIndex = Math.floor(this.length / 8);
        if (this.buffer.length <= bufIndex) this.buffer.push(0);
        if (bit) this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
        this.length++;
      }
    };

    function QR8bitByte(data) { this.mode = QRMode.MODE_8BIT_BYTE; this.data = data; }
    QR8bitByte.prototype = {
      getLength() { return this.data.length; },
      write(buffer) { for (let i = 0; i < this.data.length; i++) buffer.put(this.data.charCodeAt(i), 8); }
    };

    function QRCodeModel(typeNumber, errorCorrectLevel) {
      this.typeNumber = typeNumber;
      this.errorCorrectLevel = errorCorrectLevel;
      this.modules = null;
      this.moduleCount = 0;
      this.dataCache = null;
      this.dataList = [];
    }

    QRCodeModel.prototype = {
      addData(data) { this.dataList.push(new QR8bitByte(data)); this.dataCache = null; },
      isDark(row, col) { return this.modules[row][col]; },
      getModuleCount() { return this.moduleCount; },

      make() {
        if (this.typeNumber < 1) {
          let typeNumber = 1;
          for (typeNumber = 1; typeNumber < 40; typeNumber++) {
            const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, this.errorCorrectLevel);
            const buffer = new QRBitBuffer();
            let totalDataCount = 0;
            for (let i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;

            for (let i = 0; i < this.dataList.length; i++) {
              const data = this.dataList[i];
              buffer.put(data.mode, 4);
              buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber));
              data.write(buffer);
            }
            if (buffer.getLengthInBits() <= totalDataCount * 8) break;
          }
          this.typeNumber = typeNumber;
        }
        this.makeImpl(false, this.getBestMaskPattern());
      },

      makeImpl(test, maskPattern) {
        this.moduleCount = this.typeNumber * 4 + 17;
        this.modules = new Array(this.moduleCount);
        for (let row = 0; row < this.moduleCount; row++) {
          this.modules[row] = new Array(this.moduleCount);
          for (let col = 0; col < this.moduleCount; col++) this.modules[row][col] = null;
        }

        this.setupPositionProbePattern(0, 0);
        this.setupPositionProbePattern(this.moduleCount - 7, 0);
        this.setupPositionProbePattern(0, this.moduleCount - 7);
        this.setupPositionAdjustPattern();
        this.setupTimingPattern();
        this.setupTypeInfo(test, maskPattern);
        if (this.typeNumber >= 7) this.setupTypeNumber(test);

        if (this.dataCache == null) this.dataCache = QRCodeModel.createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
        this.mapData(this.dataCache, maskPattern);
      },

      setupPositionProbePattern(row, col) {
        for (let r = -1; r <= 7; r++) {
          if (row + r <= -1 || this.moduleCount <= row + r) continue;
          for (let c = -1; c <= 7; c++) {
            if (col + c <= -1 || this.moduleCount <= col + c) continue;
            if ((0 <= r && r <= 6 && (c === 0 || c === 6)) ||
              (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
              (2 <= r && r <= 4 && 2 <= c && c <= 4)) this.modules[row + r][col + c] = true;
            else this.modules[row + r][col + c] = false;
          }
        }
      },

      getBestMaskPattern() {
        let minLostPoint = 0;
        let pattern = 0;
        for (let i = 0; i < 8; i++) {
          this.makeImpl(true, i);
          const lostPoint = QRUtil.getLostPoint(this);
          if (i === 0 || minLostPoint > lostPoint) { minLostPoint = lostPoint; pattern = i; }
        }
        return pattern;
      },

      setupTimingPattern() {
        for (let r = 8; r < this.moduleCount - 8; r++) {
          if (this.modules[r][6] != null) continue;
          this.modules[r][6] = (r % 2 === 0);
        }
        for (let c = 8; c < this.moduleCount - 8; c++) {
          if (this.modules[6][c] != null) continue;
          this.modules[6][c] = (c % 2 === 0);
        }
      },

      setupPositionAdjustPattern() {
        const pos = QRUtil.getPatternPosition(this.typeNumber);
        for (let i = 0; i < pos.length; i++) {
          for (let j = 0; j < pos.length; j++) {
            const row = pos[i], col = pos[j];
            if (this.modules[row][col] != null) continue;
            for (let r = -2; r <= 2; r++) {
              for (let c = -2; c <= 2; c++) {
                if (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)) this.modules[row + r][col + c] = true;
                else this.modules[row + r][col + c] = false;
              }
            }
          }
        }
      },

      setupTypeNumber(test) {
        const bits = QRUtil.getBCHTypeNumber(this.typeNumber);
        for (let i = 0; i < 18; i++) this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = (!test && ((bits >> i) & 1) === 1);
        for (let i = 0; i < 18; i++) this.modules[i % 3 + this.moduleCount - 8 - 3][Math.floor(i / 3)] = (!test && ((bits >> i) & 1) === 1);
      },

      setupTypeInfo(test, maskPattern) {
        const data = (this.errorCorrectLevel << 3) | maskPattern;
        const bits = QRUtil.getBCHTypeInfo(data);

        for (let i = 0; i < 15; i++) {
          const mod = (!test && ((bits >> i) & 1) === 1);
          if (i < 6) this.modules[i][8] = mod;
          else if (i < 8) this.modules[i + 1][8] = mod;
          else this.modules[this.moduleCount - 15 + i][8] = mod;
        }

        for (let i = 0; i < 15; i++) {
          const mod = (!test && ((bits >> i) & 1) === 1);
          if (i < 8) this.modules[8][this.moduleCount - i - 1] = mod;
          else if (i < 9) this.modules[8][15 - i - 1 + 1] = mod;
          else this.modules[8][15 - i - 1] = mod;
        }

        this.modules[this.moduleCount - 8][8] = (!test);
      },

      mapData(data, maskPattern) {
        let inc = -1;
        let row = this.moduleCount - 1;
        let bitIndex = 7;
        let byteIndex = 0;

        for (let col = this.moduleCount - 1; col > 0; col -= 2) {
          if (col === 6) col--;
          while (true) {
            for (let c = 0; c < 2; c++) {
              if (this.modules[row][col - c] == null) {
                let dark = false;
                if (byteIndex < data.length) dark = (((data[byteIndex] >>> bitIndex) & 1) === 1);
                const mask = QRUtil.getMask(maskPattern, row, col - c);
                if (mask) dark = !dark;
                this.modules[row][col - c] = dark;
                bitIndex--;
                if (bitIndex === -1) { byteIndex++; bitIndex = 7; }
              }
            }
            row += inc;
            if (row < 0 || this.moduleCount <= row) { row -= inc; inc = -inc; break; }
          }
        }
      }
    };

    QRCodeModel.createData = function (typeNumber, errorCorrectLevel, dataList) {
      const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
      const buffer = new QRBitBuffer();

      for (let i = 0; i < dataList.length; i++) {
        const data = dataList[i];
        buffer.put(data.mode, 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber));
        data.write(buffer);
      }

      let totalDataCount = 0;
      for (let i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;

      if (buffer.getLengthInBits() > totalDataCount * 8) throw new Error('Code length overflow');

      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) buffer.put(0, 4);
      while (buffer.getLengthInBits() % 8 !== 0) buffer.putBit(false);

      while (true) {
        if (buffer.getLengthInBits() >= totalDataCount * 8) break;
        buffer.put(PAD0, 8);
        if (buffer.getLengthInBits() >= totalDataCount * 8) break;
        buffer.put(PAD1, 8);
      }

      return QRCodeModel.createBytes(buffer, rsBlocks);
    };

    QRCodeModel.createBytes = function (buffer, rsBlocks) {
      let offset = 0;
      let maxDcCount = 0;
      let maxEcCount = 0;

      const dcdata = new Array(rsBlocks.length);
      const ecdata = new Array(rsBlocks.length);

      for (let r = 0; r < rsBlocks.length; r++) {
        const dcCount = rsBlocks[r].dataCount;
        const ecCount = rsBlocks[r].totalCount - dcCount;

        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);

        dcdata[r] = new Array(dcCount);
        for (let i = 0; i < dcdata[r].length; i++) dcdata[r][i] = 0xff & buffer.buffer[i + offset];
        offset += dcCount;

        const rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        const rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);
        const modPoly = rawPoly.mod(rsPoly);

        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (let i = 0; i < ecdata[r].length; i++) {
          const modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = (modIndex >= 0) ? modPoly.get(modIndex) : 0;
        }
      }

      let totalCodeCount = 0;
      for (let i = 0; i < rsBlocks.length; i++) totalCodeCount += rsBlocks[i].totalCount;

      const data = new Array(totalCodeCount);
      let index = 0;

      for (let i = 0; i < maxDcCount; i++) {
        for (let r = 0; r < rsBlocks.length; r++) if (i < dcdata[r].length) data[index++] = dcdata[r][i];
      }
      for (let i = 0; i < maxEcCount; i++) {
        for (let r = 0; r < rsBlocks.length; r++) if (i < ecdata[r].length) data[index++] = ecdata[r][i];
      }
      return data;
    };

    return {
      create(text, typeNumber = 0, errorCorrectLevel = QRErrorCorrectLevel.M) {
        const qr = new QRCodeModel(typeNumber, errorCorrectLevel);
        qr.addData(text);
        qr.make();
        return qr;
      },
      toCanvas(qr, canvas, options = {}) {
        const size = options.size || 256;
        const margin = options.margin || 4;
        const darkColor = options.darkColor || '#000000';
        const lightColor = options.lightColor || '#ffffff';

        const moduleCount = qr.getModuleCount();
        const cellSize = (size - margin * 2) / moduleCount;

        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = lightColor;
        ctx.fillRect(0, 0, size, size);

        ctx.fillStyle = darkColor;
        for (let row = 0; row < moduleCount; row++) {
          for (let col = 0; col < moduleCount; col++) {
            if (qr.isDark(row, col)) {
              const x = margin + col * cellSize;
              const y = margin + row * cellSize;
              ctx.fillRect(x, y, cellSize, cellSize);
            }
          }
        }
        return canvas;
      }
    };
  })();

  // ============================================================
  // DATA EXTRACTOR
  // Extracts work metadata from the AO3 page DOM
  // ============================================================
  const DataExtractor = {
    /**
     * Extract all work data from the current AO3 page
     * @returns {Object} Work metadata including title, authors, tags, etc.
     */
    extractWorkData() {
      const data = {
        title: '',
        authors: [],
        url: '',
        canonicalUrl: '',
        rating: '',
        warnings: [],
        categories: [],
        fandoms: [],
        relationships: [],
        characters: [],
        tags: [],
        wordCount: '',
        chapters: '',
        comments: '',
        kudos: '',
        bookmarks: '',
        hits: '',
        summary: '',
        language: '',
        series: [],
        publishedDate: '',
        updatedDate: '',
        status: '',
        isChapter: false,
        currentChapter: null,
        chapterTitle: '',
        chapterNumber: null
      };

      // Extract URLs
      data.url = window.location.href;
      const canonicalLink = document.querySelector('link[rel="canonical"]');
      data.canonicalUrl = canonicalLink?.href || data.url;

      // Detect if viewing a specific chapter
      const chapterMatch = data.url.match(/\/chapters\/(\d+)/);
      data.isChapter = !!chapterMatch;
      
      if (chapterMatch) {
        data.currentChapter = chapterMatch[1];
        
        // Extract chapter title
        const chapterTitleEl = document.querySelector('.chapter .title');
        if (chapterTitleEl) {
          data.chapterTitle = chapterTitleEl.textContent.trim();
        }
        
        // Extract chapter number from dropdown selector
        const chapterSelect = document.querySelector('#selected_id');
        if (chapterSelect?.options) {
          const selectedOption = chapterSelect.options[chapterSelect.selectedIndex];
          if (selectedOption) {
            const numMatch = selectedOption.textContent.trim().match(/^(\d+)\./);
            if (numMatch) {
              data.chapterNumber = numMatch[1];
            }
          }
        }
        
        // Fallback: try to extract from chapter title
        if (!data.chapterNumber && data.chapterTitle) {
          const titleMatch = data.chapterTitle.match(/^(\d+)\./);
          if (titleMatch) {
            data.chapterNumber = titleMatch[1];
          }
        }
        
        // Last fallback: use "?" if we can't determine the number
        if (!data.chapterNumber) {
          data.chapterNumber = '?';
        }
      }

      // Extract basic metadata
      const titleElement = document.querySelector('.title.heading, h2.title');
      if (titleElement) {
        data.title = titleElement.textContent.trim();
      }

      const authorElements = document.querySelectorAll('a[rel="author"]');
      data.authors = Array.from(authorElements).map(el => ({
        name: el.textContent.trim(),
        url: el.href
      }));

      // Extract tags and metadata
      const ratingElement = document.querySelector('dd.rating.tags a, span.rating');
      if (ratingElement) {
        data.rating = ratingElement.textContent.trim();
      }

      const warningElements = document.querySelectorAll('dd.warning.tags a');
      data.warnings = Array.from(warningElements).map(el => el.textContent.trim());

      const categoryElements = document.querySelectorAll('dd.category.tags a');
      data.categories = Array.from(categoryElements).map(el => el.textContent.trim());

      const fandomElements = document.querySelectorAll('dd.fandom.tags a');
      data.fandoms = Array.from(fandomElements).map(el => el.textContent.trim());

      const relationshipElements = document.querySelectorAll('dd.relationship.tags a');
      data.relationships = Array.from(relationshipElements).map(el => el.textContent.trim());

      const characterElements = document.querySelectorAll('dd.character.tags a');
      data.characters = Array.from(characterElements).map(el => el.textContent.trim());

      const tagElements = document.querySelectorAll('dd.freeform.tags a');
      data.tags = Array.from(tagElements).map(el => el.textContent.trim());

      // Extract statistics
      const wordCountElement = document.querySelector('dd.words');
      if (wordCountElement) {
        data.wordCount = wordCountElement.textContent.trim();
      }

      const chaptersElement = document.querySelector('dd.chapters');
      if (chaptersElement) {
        data.chapters = chaptersElement.textContent.trim();
      }

      const commentsEl = document.querySelector('dd.comments');
      if (commentsEl) data.comments = commentsEl.textContent.trim();

      const kudosEl = document.querySelector('dd.kudos');
      if (kudosEl) data.kudos = kudosEl.textContent.trim();

      const bookmarksEl = document.querySelector('dd.bookmarks');
      if (bookmarksEl) data.bookmarks = bookmarksEl.textContent.trim();

      const hitsEl = document.querySelector('dd.hits');
      if (hitsEl) data.hits = hitsEl.textContent.trim();

      const publishedEl = document.querySelector('dd.published');
      if (publishedEl) data.publishedDate = publishedEl.textContent.trim();

      const updatedEl = document.querySelector('dd.status');
      if (updatedEl) data.updatedDate = updatedEl.textContent.trim();

      const statusLabelEl = document.querySelector('dt.status');
      if (statusLabelEl) data.status = statusLabelEl.textContent.trim().replace(/:$/, '');

      const seriesElements = document.querySelectorAll('dd.series .series a');
      data.series = Array.from(seriesElements).map(el => el.textContent.trim());

      // Extract summary
      const summaryElement = document.querySelector('.summary .userstuff, blockquote.userstuff');
      if (summaryElement) {
        data.summary = summaryElement.textContent.trim().replace(/\s+/g, ' ');
      }

      const languageElement = document.querySelector('dd.language');
      if (languageElement) {
        data.language = languageElement.textContent.trim();
      }

      return data;
    },

    /**
     * Get clean work URL (removes chapter-specific path)
     * @param {Object} data - Work data object
     * @returns {string} Clean work URL
     */
    getCleanWorkUrl(data) {
      const match = data.canonicalUrl.match(/archiveofourown\.org\/works\/(\d+)/);
      if (match) return `https://archiveofourown.org/works/${match[1]}`;
      return data.canonicalUrl.split('?')[0].split('#')[0];
    }
  };

  // ============================================================
  // CLIPBOARD UTILITIES
  // Handles text copying and share text generation
  // ============================================================
  const Clipboard = {
    /**
     * Copy text to clipboard using Clipboard API or fallback
     * @param {string} text - Text to copy
     * @returns {Promise<boolean>} Success status
     */
    async copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn('[AO3 Share] Clipboard API failed, using fallback:', err);
        return this._fallbackCopy(text);
      }
    },

    /**
     * Fallback copy method using the deprecated `document.execCommand` API.
     * Used only when the Clipboard API is unavailable (e.g. non-secure context).
     * @private
     */
    _fallbackCopy(text) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.cssText = 'position:fixed;opacity:0;pointer-events:none;left:-9999px;top:-9999px;';
      document.body.appendChild(textarea);
      textarea.select();
      try { 
        const success = document.execCommand('copy');
        return success;
      } catch (error) {
        console.error('[AO3 Share] Copy failed:', error);
        return false;
      } finally {
        document.body.removeChild(textarea);
      }
    },

    /**
     * Build formatted share text for the work
     * @param {Object} data - Work data
     * @param {Object} options - Formatting options
     * @returns {string} Formatted share text
     */
    buildShareText(data, options = {}) {
      const url = options.useChapter && data.isChapter ? data.url : DataExtractor.getCleanWorkUrl(data);
      const authorNames = data.authors.map(a => a.name).join(', ') || 'Anonymous';
      
      let chapterInfo = '';
      if (options.useChapter && data.isChapter) {
        const chapterNum = data.chapterNumber || data.currentChapter;
        chapterInfo = data.chapterTitle 
          ? ` (Chapter ${chapterNum}: ${data.chapterTitle})`
          : ` (Chapter ${chapterNum})`;
      }

      let text = `**[${data.title || 'Untitled Work'}${chapterInfo}](${url})**\n`;
      text += `by *${authorNames}*\n\n`;

      const meta = [];
      if (data.rating) meta.push(`**Rating:** ${data.rating}`);
      if (data.wordCount) meta.push(`**Words:** ${data.wordCount}`);
      if (data.chapters) meta.push(`**Chapters:** ${data.chapters}`);
      if (data.language) meta.push(`**Language:** ${data.language}`);
      if (meta.length) text += meta.join(' • ') + '\n';

      if (data.fandoms.length) text += `**Fandom:** ${data.fandoms.slice(0, 3).join(', ')}\n`;

      if (options.includeSummary && data.summary) {
        const truncated = data.summary.length > CONFIG.MAX_SUMMARY_LENGTH ? data.summary.slice(0, CONFIG.MAX_SUMMARY_LENGTH) + '…' : data.summary;
        text += `\n> ${truncated}\n`;
      }

      if (options.includeTags && data.tags.length) {
        const displayTags = data.tags.slice(0, CONFIG.MAX_TAGS_DISPLAY);
        text += `\n**Tags:** ${displayTags.join(', ')}`;
        if (data.tags.length > CONFIG.MAX_TAGS_DISPLAY) text += ` (+${data.tags.length - CONFIG.MAX_TAGS_DISPLAY} more)`;
        text += '\n';
      }

      return text.trim();
    }
  };

  // ============================================================
  // CARD RENDERER
  // Generates shareable image cards with QR codes and work metadata
  // Features adaptive layout that adjusts canvas height based on content
  // ============================================================
  const CardRenderer = {
    /**
     * Generate a shareable card image
     * @param {Object} data - Work data
     * @param {Object} options - Rendering options
     * @returns {HTMLCanvasElement} Generated card canvas
     */
    generateCard(data, options = {}) {
      const logicalW = options.width || CONFIG.CARD_DIMENSIONS.width;
      
      // Calculate required height based on content
      const requiredHeight = this.calculateRequiredHeight(data, logicalW, options);
      const logicalH = requiredHeight;

      const dpr = Math.max(1, Math.round((options.dpr || window.devicePixelRatio || 1) * 100) / 100);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(logicalW * dpr);
      canvas.height = Math.round(logicalH * dpr);
      canvas.style.width = `${logicalW}px`;
      canvas.style.height = `${logicalH}px`;

      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;

      const url = options.useCurrentChapter && data.isChapter ? data.url : DataExtractor.getCleanWorkUrl(data);

      const pad = 22;
      const innerX = pad, innerY = pad;
      const innerW = logicalW - pad * 2;
      const innerH = logicalH - pad * 2;

      const headerH = 62;
      const footerH = 52;

      const title = data.title || 'Untitled Work';

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, logicalW, logicalH);

      // Border frame
      ctx.strokeStyle = CONFIG.COLORS.border;
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, logicalW - 20, logicalH - 20);

      // Header band — work title
      ctx.fillStyle = CONFIG.COLORS.subtle;
      ctx.fillRect(innerX, innerY, innerW, headerH);

      const headerMaxTextW = innerW - 24;
      const headerFontMax = 19;
      const headerFontMin = 12;
      let headerFont = headerFontMax;
      let headerTitleLines = [];
      for (let size = headerFontMax; size >= headerFontMin; size--) {
        ctx.font = `bold ${size}px Georgia, "Times New Roman", serif`;
        headerTitleLines = this.wrapText(ctx, title, headerMaxTextW);
        if (headerTitleLines.length <= 2) { headerFont = size; break; }
      }
      if (headerTitleLines.length > 2) {
        headerTitleLines = headerTitleLines.slice(0, 2);
        headerTitleLines[1] = this.ellipsize(ctx, headerTitleLines[1], headerMaxTextW);
      }
      ctx.font = `bold ${headerFont}px Georgia, "Times New Roman", serif`;
      const headerLineH = Math.round(headerFont * 1.25);
      const headerTotalTextH = headerTitleLines.length * headerLineH;
      const headerTextStartY = innerY + Math.round((headerH - headerTotalTextH) / 2) + Math.round(headerLineH * 0.8);
      ctx.fillStyle = CONFIG.COLORS.ao3RedDark;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      for (let i = 0; i < headerTitleLines.length; i++) {
        ctx.fillText(headerTitleLines[i], innerX + innerW / 2, headerTextStartY + i * headerLineH);
      }

      // Divider under header
      ctx.strokeStyle = CONFIG.COLORS.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(innerX, innerY + headerH);
      ctx.lineTo(innerX + innerW, innerY + headerH);
      ctx.stroke();

      // Footer divider
      ctx.beginPath();
      ctx.moveTo(innerX, innerY + innerH - footerH);
      ctx.lineTo(innerX + innerW, innerY + innerH - footerH);
      ctx.stroke();

      // Footer text
      ctx.fillStyle = CONFIG.COLORS.muted;
      ctx.font = '12px Georgia, "Times New Roman", serif';
      ctx.textAlign = 'left';
      ctx.fillText('archiveofourown.org', innerX + 12, innerY + innerH - 18);

      ctx.textAlign = 'right';
      ctx.fillStyle = CONFIG.COLORS.ao3Red;
      ctx.fillText('Scan to read', innerX + innerW - 12, innerY + innerH - 18);

      // ===== CLIP BODY (hard guarantee: nothing can draw over the footer/header area) =====
      const clipTop = innerY + headerH + 1;
      const clipBottom = innerY + innerH - footerH - 1;
      const clipH = Math.max(0, clipBottom - clipTop);
      ctx.save();
      ctx.beginPath();
      ctx.rect(innerX + 1, clipTop, innerW - 2, clipH);
      ctx.clip();

      // ===== Body layout (author above QR, QR centered, info in 2 cols under QR) =====
      const bodyTop = innerY + headerH + 14;
      const bodyBottom = innerY + innerH - footerH - 12;
      const author = (data.authors.length ? data.authors.map(a => a.name).join(', ') : 'Anonymous');

      const maxTextW = innerW - 24;
      let y = bodyTop;

      // ---- Pre-compute ALL content that appears below the QR so sizing is accurate ----
      const metaItems = [];
      if (options.showRating !== false && data.rating)          metaItems.push({ label: 'Rating',    value: data.rating });
      if (options.showWordCount !== false && data.wordCount)    metaItems.push({ label: 'Words',     value: data.wordCount });
      if (options.showChapters !== false && data.chapters)      metaItems.push({ label: 'Chapters',  value: data.chapters });
      if (options.showLanguage !== false && data.language)      metaItems.push({ label: 'Lang',      value: data.language });
      if (options.showStatus && data.status && data.updatedDate) metaItems.push({ label: data.status || 'Updated', value: data.updatedDate });
      if (options.showPublished && data.publishedDate)          metaItems.push({ label: 'Published', value: data.publishedDate });
      if (options.showKudos && data.kudos)                      metaItems.push({ label: 'Kudos',     value: data.kudos });
      if (options.showHits && data.hits)                        metaItems.push({ label: 'Hits',      value: data.hits });

      const metaRowH = 34;
      const metaRows = Math.ceil(metaItems.length / 2);
      const metaBlockH = metaRows > 0 ? metaRows * metaRowH + 10 : 0;

      // Resolve effective arrays, honouring per-item sub-selections from options
      const activeFandoms       = options.filteredFandoms       ?? data.fandoms;
      const activeWarnings      = options.filteredWarnings      ?? data.warnings;
      const activeCategories    = options.filteredCategories    ?? data.categories;
      const activeRelationships = options.filteredRelationships ?? data.relationships;
      const activeCharacters    = options.filteredCharacters    ?? data.characters;
      const activeTags          = options.filteredTags          ?? data.tags;
      const activeSeries        = options.filteredSeries        ?? data.series;

      const fandomWillDraw = (options.showFandoms !== false && activeFandoms && activeFandoms.length);

      const hasExtras = !!(options.showWarnings && activeWarnings && activeWarnings.length) ||
                        !!(options.showCategories && activeCategories && activeCategories.length) ||
                        !!(options.showRelationships && activeRelationships && activeRelationships.length) ||
                        !!(options.showCharacters && activeCharacters && activeCharacters.length) ||
                        !!(options.showTags && activeTags && activeTags.length) ||
                        !!(options.showSeries && activeSeries && activeSeries.length) ||
                        !!(options.showSummary && data.summary);

      let extrasH = hasExtras ? 14 : 0; // section divider
      if (options.showWarnings && activeWarnings && activeWarnings.length) extrasH += 20;
      if (options.showCategories && activeCategories && activeCategories.length) extrasH += 20;
      if (options.showRelationships && activeRelationships && activeRelationships.length) extrasH += 20;
      if (options.showCharacters && activeCharacters && activeCharacters.length) extrasH += 20;
      if (options.showTags && activeTags && activeTags.length) extrasH += 20;
      if (options.showSeries && activeSeries && activeSeries.length) extrasH += 20;
      if (options.showSummary && data.summary) {
        const _tc = document.createElement('canvas');
        const _tx = _tc.getContext('2d');
        _tx.font = '12.5px Georgia, "Times New Roman", serif';
        const _sl = this.wrapText(_tx, data.summary.replace(/\s+/g, ' '), innerW - 24);
        extrasH += 20 + _sl.length * 16 + 4;
      }

      // Author
      ctx.fillStyle = CONFIG.COLORS.muted;
      ctx.font = 'italic 14px Georgia, "Times New Roman", serif';
      ctx.textAlign = 'center';
      ctx.fillText(`by ${this.ellipsize(ctx, author, maxTextW)}`, innerX + innerW / 2, y + 14);
      y += 28;

      // Chapter indication if sharing a chapter
      if (options.useCurrentChapter && data.isChapter) {
        const chapterNum = data.chapterNumber;
        ctx.fillStyle = CONFIG.COLORS.ao3Red;
        ctx.font = 'bold 13px Georgia, "Times New Roman", serif';
        ctx.fillText(`Chapter: ${chapterNum}`, innerX + innerW / 2, y + 14);
        y += 22;
      }

      // Divider before QR
      ctx.strokeStyle = CONFIG.COLORS.border;
      ctx.beginPath();
      ctx.moveTo(innerX + 24, y);
      ctx.lineTo(innerX + innerW - 24, y);
      ctx.stroke();
      y += 16;

      // QR is always the configured size — the card height (from calculateRequiredHeight) already
      // accounts for all content, so there is no need to shrink it.
      const qrBox = Math.min(options.qrSize || CONFIG.QR_SIZE, innerW - 80);

      // Draw QR
      const qrX = innerX + Math.floor((innerW - qrBox) / 2);
      const qrY = y;

      const qr = QRCode.create(url);
      const qrCanvas = document.createElement('canvas');
      QRCode.toCanvas(qr, qrCanvas, {
        size: Math.round(qrBox),
        margin: 6,
        darkColor: '#000000',
        lightColor: '#ffffff'
      });

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = CONFIG.COLORS.border;
      ctx.lineWidth = 1;
      ctx.fillRect(qrX - 8, qrY - 8, qrBox + 16, qrBox + 16);
      ctx.strokeRect(qrX - 8, qrY - 8, qrBox + 16, qrBox + 16);
      ctx.drawImage(qrCanvas, qrX, qrY, qrBox, qrBox);

      y = qrY + qrBox + 16;

      // Divider under QR
      ctx.strokeStyle = CONFIG.COLORS.border;
      ctx.beginPath();
      ctx.moveTo(innerX + 24, y);
      ctx.lineTo(innerX + innerW - 24, y);
      ctx.stroke();
      y += 18;

      // Meta 2 columns
      const colGap = 28;
      const colW = (innerW - 24 - colGap) / 2;
      const leftColX = innerX + 12 + colW / 2;
      const rightColX = innerX + 12 + colW + colGap + colW / 2;

      ctx.textAlign = 'center';
      for (let i = 0; i < metaItems.length; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const cx = col === 0 ? leftColX : rightColX;
        const cy = y + row * metaRowH;

        ctx.fillStyle = CONFIG.COLORS.ao3RedDark;
        ctx.font = 'bold 12px Georgia, "Times New Roman", serif';
        ctx.fillText(`${metaItems[i].label}:`, cx, cy + 12);

        ctx.fillStyle = CONFIG.COLORS.text;
        ctx.font = '13px Georgia, "Times New Roman", serif';
        const v = metaItems[i].value ? this.ellipsize(ctx, metaItems[i].value, colW - 10) : '';
        ctx.fillText(v, cx, cy + 28);
      }
      y += metaBlockH;

      // Helper to draw a full-width label+value row
      const drawRow = (label, value) => {
        ctx.fillStyle = CONFIG.COLORS.ao3RedDark;
        ctx.font = `bold 12px Georgia, "Times New Roman", serif`;
        ctx.textAlign = 'left';
        ctx.fillText(`${label}:`, innerX + 12, y + 14);
        const lw = ctx.measureText(`${label}: `).width;
        ctx.fillStyle = CONFIG.COLORS.text;
        ctx.font = '12.5px Georgia, "Times New Roman", serif';
        ctx.fillText(this.ellipsize(ctx, value, innerW - 24 - lw), innerX + 12 + lw, y + 14);
        y += 20;
      };

      // Helper to draw a wrapped-text section
      const drawSection = (label, text) => {
        ctx.fillStyle = CONFIG.COLORS.ao3RedDark;
        ctx.font = 'bold 13px Georgia, "Times New Roman", serif';
        ctx.textAlign = 'left';
        ctx.fillText(label, innerX + 12, y + 14);
        y += 20;
        ctx.fillStyle = CONFIG.COLORS.text;
        ctx.font = '12.5px Georgia, "Times New Roman", serif';
        const lines = this.wrapText(ctx, text, innerW - 24);
        for (const line of lines) { ctx.fillText(line, innerX + 12, y + 14); y += 16; }
        y += 4;
      };

      // Fandom
      if (fandomWillDraw) {
        const fandomText = activeFandoms.join(' • ');
        drawRow('Fandoms', fandomText);
      }

      // Optional extra rows — each guarded by its option flag
      if (hasExtras) {
        ctx.strokeStyle = CONFIG.COLORS.border;
        ctx.beginPath();
        ctx.moveTo(innerX, y + 4);
        ctx.lineTo(innerX + innerW, y + 4);
        ctx.stroke();
        y += 14;
      }

      if (options.showWarnings && activeWarnings && activeWarnings.length) {
        drawRow('Warnings', activeWarnings.join(', '));
      }
      if (options.showCategories && activeCategories && activeCategories.length) {
        drawRow('Categories', activeCategories.join(', '));
      }
      if (options.showRelationships && activeRelationships && activeRelationships.length) {
        drawRow('Relationships', activeRelationships.join(', '));
      }
      if (options.showCharacters && activeCharacters && activeCharacters.length) {
        drawRow('Characters', activeCharacters.join(', '));
      }
      if (options.showTags && activeTags && activeTags.length) {
        drawRow('Tags', activeTags.join(', '));
      }
      if (options.showSeries && activeSeries && activeSeries.length) {
        drawRow('Series', activeSeries.join(', '));
      }
      if (options.showSummary && data.summary) {
        drawSection('Summary', data.summary.replace(/\s+/g, ' '));
      }

      // End clip
      ctx.restore();
      return canvas;
    },

    calculateRequiredHeight(data, logicalW, options = {}) {
      const tempCanvas = document.createElement('canvas');
      const ctx = tempCanvas.getContext('2d');
      
      const pad = 22;
      const innerW = logicalW - pad * 2;
      const headerH = 62;
      const footerH = 52;
      const bodyTop = pad + headerH + 14;
      
      let y = bodyTop;
      
      // Author
      y += 28;
      
      // Divider
      y += 16;
      
      // QR code (use the desired/configured size, not minimum)
      const qrBox = Math.min(options.qrSize || CONFIG.QR_SIZE, innerW - 80);
      y += qrBox + 34; // qrBox + 16px gap below + 18px divider
      
      // Meta grid rows
      let metaCount = 0;
      if (options.showRating !== false && data.rating) metaCount++;
      if (options.showWordCount !== false && data.wordCount) metaCount++;
      if (options.showChapters !== false && data.chapters) metaCount++;
      if (options.showLanguage !== false && data.language) metaCount++;
      if (options.showStatus && data.updatedDate) metaCount++;
      if (options.showPublished && data.publishedDate) metaCount++;
      if (options.showKudos && data.kudos) metaCount++;
      if (options.showHits && data.hits) metaCount++;
      const metaRows = Math.ceil(metaCount / 2);
      y += metaRows > 0 ? metaRows * 34 + 10 : 0;

      // Fandom row
      const activeFandoms       = options.filteredFandoms       ?? data.fandoms;
      const activeWarnings      = options.filteredWarnings      ?? data.warnings;
      const activeCategories    = options.filteredCategories    ?? data.categories;
      const activeRelationships = options.filteredRelationships ?? data.relationships;
      const activeCharacters    = options.filteredCharacters    ?? data.characters;
      const activeTags          = options.filteredTags          ?? data.tags;
      const activeSeries        = options.filteredSeries        ?? data.series;

      if (options.showFandoms !== false && activeFandoms && activeFandoms.length) y += 20;

      // Divider before extras
      const hasExtras = (options.showWarnings && activeWarnings && activeWarnings.length) ||
                        (options.showCategories && activeCategories && activeCategories.length) ||
                        (options.showRelationships && activeRelationships && activeRelationships.length) ||
                        (options.showCharacters && activeCharacters && activeCharacters.length) ||
                        (options.showTags && activeTags && activeTags.length) ||
                        (options.showSeries && activeSeries && activeSeries.length) ||
                        (options.showSummary && data.summary);
      if (hasExtras) y += 14;

      if (options.showWarnings && activeWarnings && activeWarnings.length) y += 20;
      if (options.showCategories && activeCategories && activeCategories.length) y += 20;
      if (options.showRelationships && activeRelationships && activeRelationships.length) y += 20;
      if (options.showCharacters && activeCharacters && activeCharacters.length) y += 20;
      if (options.showTags && activeTags && activeTags.length) y += 20;
      if (options.showSeries && activeSeries && activeSeries.length) y += 20;

      if (options.showSummary && data.summary) {
        y += 20;
        ctx.font = '12.5px Georgia, "Times New Roman", serif';
        const sumLines = this.wrapText(ctx, data.summary.replace(/\s+/g, ' '), innerW - 24);
        y += sumLines.length * 16 + 4;
      }
      
      // Footer
      y += footerH + pad + 12;
      
      return y;
    },

    wrapText(ctx, text, maxWidth) {
      const words = String(text || '').split(/\s+/).filter(Boolean);
      const lines = [];
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const w = ctx.measureText(testLine).width;
        if (w > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);
      return lines;
    },

    ellipsize(ctx, text, maxWidth) {
      let t = String(text || '');
      if (ctx.measureText(t).width <= maxWidth) return t;
      while (t.length > 0 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
      return (t.length ? t + '…' : '…');
    }
  };

  // ============================================================
  // UI CONTROLLER
  // Manages the share panel interface and user interactions
  // ============================================================
  const UI = {
    styles: null,
    overlay: null,
    panel: null,
    button: null,
    isOpen: false,
    workData: null,
    lastCardCanvas: null,
    lastCardKey: '',

    /**
     * Initialize the UI components
     */
    init() {
      this.injectStyles();
      this.createButton();
      this.createPanel();
      this.attachEventListeners();
    },

    /**
     * Inject CSS styles into the document
     */
    injectStyles() {
      this.styles = document.createElement('style');
      this.styles.textContent = `
        .ao3sp-button{
          position:fixed; bottom:${CONFIG.BUTTON_POSITION.bottom}; right:${CONFIG.BUTTON_POSITION.right};
          padding:10px 12px; border-radius:8px;
          background:${CONFIG.COLORS.ao3Red}; border:1px solid ${CONFIG.COLORS.ao3RedDark};
          cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,0.25);
          z-index:99998; color:#fff;
          font:14px Georgia,"Times New Roman",serif;
          display:flex; align-items:center; gap:8px;
        }
        .ao3sp-button:hover{filter:brightness(1.05)}
        .ao3sp-button:active{transform:translateY(1px)}
        .ao3sp-button svg{width:18px;height:18px}

        .ao3sp-overlay{
          position:fixed; inset:0; background:rgba(0,0,0,0.45);
          z-index:99999; opacity:0; visibility:hidden;
          transition:opacity ${CONFIG.ANIMATION_DURATION}ms ease, visibility ${CONFIG.ANIMATION_DURATION}ms ease;
        }
        .ao3sp-overlay.ao3sp-open{opacity:1; visibility:visible}

        .ao3sp-panel{
          position:fixed; top:50%; left:50%;
          transform:translate(-50%,-50%) scale(0.98);
          width:min(880px,96vw); max-height:min(92vh,900px);
          background:${CONFIG.COLORS.panelBg};
          border:1px solid ${CONFIG.COLORS.border}; border-radius:10px;
          box-shadow:0 18px 60px rgba(0,0,0,0.35);
          z-index:100000; opacity:0; visibility:hidden;
          transition:opacity ${CONFIG.ANIMATION_DURATION}ms ease, transform ${CONFIG.ANIMATION_DURATION}ms ease, visibility ${CONFIG.ANIMATION_DURATION}ms ease;
          font:14px Georgia,"Times New Roman",serif;
          color:${CONFIG.COLORS.text};
          display:flex; flex-direction:column; overflow:hidden;
        }
        .ao3sp-panel.ao3sp-open{opacity:1; visibility:visible; transform:translate(-50%,-50%) scale(1)}

        .ao3sp-header{
          display:flex; align-items:center; justify-content:space-between;
          padding:14px 16px; background:${CONFIG.COLORS.subtle};
          border-bottom:1px solid ${CONFIG.COLORS.border};
          border-radius:10px 10px 0 0; flex-shrink:0;
        }
        .ao3sp-title{margin:0; font-size:16px; font-weight:bold; color:${CONFIG.COLORS.ao3RedDark}}
        .ao3sp-close{
          width:34px; height:34px; border:1px solid ${CONFIG.COLORS.border};
          background:#fff; border-radius:6px; cursor:pointer;
          display:grid; place-items:center; color:${CONFIG.COLORS.muted};
        }
        .ao3sp-close:hover{color:${CONFIG.COLORS.text}; border-color:#c9c9c9}

        /* Two-column body */
        .ao3sp-body{
          display:flex; flex:1; overflow:hidden; min-height:0;
        }

        /* Left: live preview */
        .ao3sp-preview-col{
          flex:0 0 clamp(220px,42%,460px);
          background:#e8e8e8;
          display:flex; flex-direction:column; align-items:center;
          padding:16px 12px; overflow-y:auto; gap:10px;
          border-right:1px solid ${CONFIG.COLORS.border};
        }
        .ao3sp-preview-label{
          font-size:11px; color:${CONFIG.COLORS.muted}; text-transform:uppercase; letter-spacing:.06em; align-self:flex-start;
        }
        .ao3sp-preview-wrap{
          background:#fff; box-shadow:0 4px 18px rgba(0,0,0,0.18); border-radius:4px; overflow:hidden;
          display:flex; align-items:flex-start; justify-content:center;
          width:100%;
        }
        #ao3sp-preview-canvas{
          display:block; max-width:100%;
        }

        /* Right: controls */
        .ao3sp-controls-col{
          flex:1; overflow-y:auto; padding:16px;
          display:flex; flex-direction:column; gap:12px;
          min-width:0;
        }

        .ao3sp-info-section{
          border:1px solid ${CONFIG.COLORS.border}; border-radius:8px;
          padding:10px 12px; background:#fff;
        }
        .ao3sp-info-title{margin:0 0 2px 0; font-weight:bold; font-size:14px; color:${CONFIG.COLORS.text}}
        .ao3sp-info-author{margin:2px 0 0 0; color:${CONFIG.COLORS.muted}; font-style:italic; font-size:12px}
        .ao3sp-info-stats{margin-top:6px; display:flex; flex-wrap:wrap; gap:8px; color:${CONFIG.COLORS.muted}; font-size:11px}

        .ao3sp-link-options{display:flex; gap:8px;}
        .ao3sp-link-option{
          flex:1; padding:8px 10px; border-radius:6px;
          border:1px solid ${CONFIG.COLORS.border}; background:#fff; cursor:pointer;
          font:13px Georgia,"Times New Roman",serif; color:${CONFIG.COLORS.text};
        }
        .ao3sp-link-option:hover{background:${CONFIG.COLORS.subtle}}
        .ao3sp-link-option.ao3sp-active{
          border-color:${CONFIG.COLORS.ao3Red};
          box-shadow:inset 0 0 0 1px ${CONFIG.COLORS.ao3Red};
        }

        /* Field checklist */
        .ao3sp-fields-box{
          border:1px solid ${CONFIG.COLORS.border}; border-radius:8px;
        }
        .ao3sp-fields-header{
          padding:8px 12px; background:${CONFIG.COLORS.subtle};
          border-bottom:1px solid ${CONFIG.COLORS.border};
          font-size:12px; font-weight:bold; color:${CONFIG.COLORS.muted};
          text-transform:uppercase; letter-spacing:.05em;
        }
        .ao3sp-fields-list{
          padding:6px 4px; display:flex; flex-direction:column; gap:0;
          max-height:min(320px,28vh); overflow-y:auto;
        }
        .ao3sp-field-row{
          display:flex; align-items:center; gap:8px;
          padding:5px 8px; border-radius:5px; cursor:pointer;
          user-select:none;
        }
        .ao3sp-field-row:hover{background:${CONFIG.COLORS.subtle}}
        .ao3sp-field-row input[type=checkbox]{
          width:15px; height:15px; accent-color:${CONFIG.COLORS.ao3Red}; cursor:pointer; flex-shrink:0;
        }
        .ao3sp-field-name{font-size:13px; flex:1}
        .ao3sp-field-value{font-size:11px; color:${CONFIG.COLORS.muted}; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
        .ao3sp-field-empty{font-size:11px; color:#bbb; font-style:italic}
        .ao3sp-sublist{
          display:flex; flex-direction:column; gap:0;
          padding-left:22px; margin-bottom:2px;
        }
        .ao3sp-sublist.ao3sp-sublist-hidden{display:none}
        .ao3sp-sub-row{
          display:flex; align-items:center; gap:6px;
          padding:3px 8px 3px 4px; border-radius:4px; cursor:pointer;
          user-select:none;
        }
        .ao3sp-sub-row:hover{background:${CONFIG.COLORS.subtle}}
        .ao3sp-sub-row input[type=checkbox]{
          width:13px; height:13px; accent-color:${CONFIG.COLORS.ao3Red}; cursor:pointer; flex-shrink:0;
        }
        .ao3sp-sub-label{font-size:12px; color:${CONFIG.COLORS.text}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap}

        .ao3sp-actions{
          display:flex; flex-direction:column; gap:8px;
        }
        .ao3sp-btn{
          padding:9px 12px; border-radius:6px;
          border:1px solid ${CONFIG.COLORS.border}; background:#fff; cursor:pointer;
          display:inline-flex; align-items:center; justify-content:center; gap:8px;
          font:14px Georgia,"Times New Roman",serif; color:${CONFIG.COLORS.text};
        }
        .ao3sp-btn:hover{background:${CONFIG.COLORS.subtle}}
        .ao3sp-btn-success{background:#0f7a3a!important; border-color:#0b5a2b!important; color:#fff!important}

        .ao3sp-tip{ color:${CONFIG.COLORS.muted}; font-size:11px; text-align:center; }

        .ao3sp-toast{
          position:fixed; bottom:18px; left:50%;
          transform:translateX(-50%) translateY(30px);
          background:#fff; color:${CONFIG.COLORS.text};
          padding:10px 12px; border-radius:8px; border:1px solid ${CONFIG.COLORS.border};
          box-shadow:0 10px 28px rgba(0,0,0,0.25);
          z-index:100001; opacity:0;
          transition:opacity 220ms ease, transform 220ms ease;
          display:flex; align-items:center; gap:10px;
          font:14px Georgia,"Times New Roman",serif;
        }
        .ao3sp-toast.ao3sp-visible{opacity:1; transform:translateX(-50%) translateY(0)}
        .ao3sp-toast .ao3sp-dot{width:10px;height:10px;border-radius:50%; background:${CONFIG.COLORS.ao3Red}}

        /* Short viewports (e.g. laptop, 1080p with browser chrome/taskbar, 125% scaling) */
        @media(max-height:780px){
          .ao3sp-panel{max-height:97vh;}
          .ao3sp-header{padding:10px 14px;}
          .ao3sp-controls-col{padding:10px 12px; gap:8px;}
          .ao3sp-fields-list{max-height:min(200px,20vh);}
        }

        /* Narrower two-column: shrink preview proportion */
        @media(max-width:860px){
          .ao3sp-preview-col{flex:0 0 clamp(180px,38%,340px);}
        }

        /* Single column below 680px */
        @media(max-width:680px){
          .ao3sp-body{flex-direction:column;}
          .ao3sp-preview-col{
            flex:none; width:100%; border-right:none;
            border-bottom:1px solid ${CONFIG.COLORS.border};
            max-height:36vh; padding:10px;
          }
          .ao3sp-controls-col{padding:10px 12px; gap:8px;}
          .ao3sp-fields-list{max-height:min(220px,22vh);}
          .ao3sp-actions{display:grid; grid-template-columns:1fr 1fr;}
        }

        /* Mobile / very small screens */
        @media(max-width:480px){
          .ao3sp-panel{width:100vw; max-height:100vh; border-radius:0;}
          .ao3sp-preview-col{max-height:28vh;}
          .ao3sp-fields-list{max-height:min(180px,18vh);}
        }
      `;
      document.head.appendChild(this.styles);
    },

    createButton() {
      this.button = document.createElement('button');
      this.button.className = 'ao3sp-button';
      this.button.setAttribute('aria-label', 'Share this work');
      this.button.setAttribute('title', 'Share');
      this.button.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
        <span>Share</span>
      `;
      document.body.appendChild(this.button);
    },

    createPanel() {
      this.overlay = document.createElement('div');
      this.overlay.className = 'ao3sp-overlay';
      document.body.appendChild(this.overlay);

      this.panel = document.createElement('div');
      this.panel.className = 'ao3sp-panel';
      this.panel.setAttribute('role', 'dialog');
      this.panel.setAttribute('aria-modal', 'true');
      this.panel.setAttribute('aria-labelledby', 'ao3sp-panel-title');

      this.panel.innerHTML = `
        <div class="ao3sp-header">
          <h2 class="ao3sp-title" id="ao3sp-panel-title">Share This Work</h2>
          <button class="ao3sp-close" aria-label="Close panel" title="Close" type="button">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="ao3sp-body">
          <!-- Left: card preview -->
          <div class="ao3sp-preview-col">
            <span class="ao3sp-preview-label">Card preview</span>
            <div class="ao3sp-preview-wrap">
              <canvas id="ao3sp-preview-canvas"></canvas>
            </div>
          </div>

          <!-- Right: controls -->
          <div class="ao3sp-controls-col">

            <div class="ao3sp-info-section">
              <p class="ao3sp-info-title" id="ao3sp-info-title">Loading…</p>
              <p class="ao3sp-info-author" id="ao3sp-info-author"></p>
              <div class="ao3sp-info-stats" id="ao3sp-info-stats"></div>
            </div>

            <div class="ao3sp-link-options">
              <button class="ao3sp-link-option ao3sp-active" data-qr="work" type="button">Work link</button>
              <button class="ao3sp-link-option" data-qr="chapter" type="button" id="ao3sp-chapter-btn">Chapter link</button>
            </div>

            <div class="ao3sp-fields-box">
              <div class="ao3sp-fields-header">Card fields</div>
              <div class="ao3sp-fields-list" id="ao3sp-fields-list"></div>
            </div>

            <div class="ao3sp-actions">
              <button class="ao3sp-btn" id="ao3sp-copy-text-btn" type="button" title="Copy share text">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copy text
              </button>
              <button class="ao3sp-btn" id="ao3sp-download-btn" type="button" title="Download the card image">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download card
              </button>
              <button class="ao3sp-btn" id="ao3sp-copy-card-btn" type="button" title="Copy card image to clipboard">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="8" y="8" width="13" height="13" rx="2" ry="2"/>
                  <path d="M4 16H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1"/>
                  <path d="M8 14l2-2 3 3 2-2 3 3"/>
                </svg>
                Copy card
              </button>
              <button class="ao3sp-btn" id="ao3sp-copy-link-btn" type="button" title="Copy the link">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1"/><path d="M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1"/>
                </svg>
                Copy link
              </button>
            </div>

            <div class="ao3sp-tip">Tip: press <b>S</b> to open. Press <b>Esc</b> to close.</div>
          </div>
        </div>
      `;
      document.body.appendChild(this.panel);
    },

    /**
     * Attach event listeners to UI elements
     */
    attachEventListeners() {
      this.button.addEventListener('click', () => this.open());
      this.overlay.addEventListener('click', () => this.close());
      this.panel.querySelector('.ao3sp-close').addEventListener('click', () => this.close());

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) { this.close(); return; }
        if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const activeEl = document.activeElement;
          const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
          if (!isInput && !this.isOpen) { e.preventDefault(); this.open(); }
        }
      });

      const qrOptions = this.panel.querySelectorAll('.ao3sp-link-option');
      qrOptions.forEach(opt => {
        opt.addEventListener('click', () => {
          qrOptions.forEach(o => o.classList.remove('ao3sp-active'));
          opt.classList.add('ao3sp-active');
          this.schedulePreviewUpdate();
        });
      });

      this.panel.querySelector('#ao3sp-download-btn').addEventListener('click', () => this.downloadCard());
      this.panel.querySelector('#ao3sp-copy-card-btn').addEventListener('click', () => this.copyCard());
      this.panel.querySelector('#ao3sp-copy-text-btn').addEventListener('click', () => this.copyShareText());
      this.panel.querySelector('#ao3sp-copy-link-btn').addEventListener('click', () => this.copyLink());
    },

    /**
     * Open the share panel
     */
    async open() {
      this.isOpen = true;
      this.workData = DataExtractor.extractWorkData();

      const chapterBtn = this.panel.querySelector('[data-qr="chapter"]');
      if (this.workData.isChapter) {
        chapterBtn.style.display = '';
        const chapterNum = this.workData.chapterNumber || this.workData.currentChapter;
        chapterBtn.textContent = `Chapter: ${chapterNum}`;
      } else {
        chapterBtn.style.display = 'none';
        this.panel.querySelectorAll('.ao3sp-link-option').forEach(o => o.classList.remove('ao3sp-active'));
        this.panel.querySelector('[data-qr="work"]').classList.add('ao3sp-active');
      }

      this.updateInfo();
      this.buildFieldChecklist();
      this.lastCardKey = '';
      this.updatePreview();

      this.overlay.classList.add('ao3sp-open');
      this.panel.classList.add('ao3sp-open');
      this.panel.querySelector('.ao3sp-close').focus();
    },

    /**
     * Close the share panel
     */
    close() {
      this.isOpen = false;
      this.overlay.classList.remove('ao3sp-open');
      this.panel.classList.remove('ao3sp-open');
      this.button.focus();
    },

    getUseChapter() {
      const chapterActive = this.panel.querySelector('[data-qr="chapter"]')?.classList.contains('ao3sp-active');
      return !!(chapterActive && this.workData && this.workData.isChapter);
    },

    /**
     * Definition of all toggleable card fields.
     * key: option property name passed to CardRenderer
     * label: shown in the checklist
     * dataKey: key(s) on workData to check for non-empty value (null = always available)
     * defaultOn: whether it defaults to checked
     */
    _fieldDefs() {
      return [
        { key: 'showRating',        label: 'Rating',        dataKey: 'rating',         defaultOn: true },
        { key: 'showWordCount',     label: 'Word count',    dataKey: 'wordCount',      defaultOn: true },
        { key: 'showChapters',      label: 'Chapters',      dataKey: 'chapters',       defaultOn: true },
        { key: 'showLanguage',      label: 'Language',      dataKey: 'language',       defaultOn: true },
        { key: 'showFandoms',       label: 'Fandoms',       dataKey: 'fandoms',        defaultOn: true,  multiValue: true },
        { key: 'showWarnings',      label: 'Warnings',      dataKey: 'warnings',       defaultOn: false, multiValue: true },
        { key: 'showCategories',    label: 'Categories',    dataKey: 'categories',     defaultOn: false, multiValue: true },
        { key: 'showRelationships', label: 'Relationships', dataKey: 'relationships',  defaultOn: false, multiValue: true },
        { key: 'showCharacters',    label: 'Characters',    dataKey: 'characters',     defaultOn: false, multiValue: true },
        { key: 'showTags',          label: 'Tags',          dataKey: 'tags',           defaultOn: false, multiValue: true },
        { key: 'showSeries',        label: 'Series',        dataKey: 'series',         defaultOn: false, multiValue: true },
        { key: 'showStatus',        label: 'Status / updated date', dataKey: 'updatedDate', defaultOn: false },
        { key: 'showPublished',     label: 'Published date',dataKey: 'publishedDate',  defaultOn: false },
        { key: 'showKudos',         label: 'Kudos',         dataKey: 'kudos',          defaultOn: false },
        { key: 'showHits',          label: 'Hits',          dataKey: 'hits',           defaultOn: false },
        { key: 'showSummary',       label: 'Summary',       dataKey: 'summary',        defaultOn: false },
      ];
    },

    buildFieldChecklist() {
      const list = this.panel.querySelector('#ao3sp-fields-list');
      list.innerHTML = '';
      const defs = this._fieldDefs();

      defs.forEach(def => {
        const data = this.workData;
        const rawVal = data[def.dataKey];
        const hasValue = Array.isArray(rawVal) ? rawVal.length > 0 : !!rawVal;

        // Value preview string
        let preview = '';
        if (hasValue) {
          preview = Array.isArray(rawVal)
            ? rawVal.slice(0, 3).join(', ') + (rawVal.length > 3 ? ` +${rawVal.length - 3}` : '')
            : String(rawVal);
        }

        const savedKey = `field-${def.key}`;
        const storedVal = Storage.get(savedKey, null);
        const checked = storedVal !== null ? storedVal : def.defaultOn;

        const row = document.createElement('label');
        row.className = 'ao3sp-field-row';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = checked;
        cb.dataset.fieldKey = def.key;
        if (!hasValue) cb.disabled = true;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'ao3sp-field-name';
        nameSpan.textContent = def.label;

        const valueSpan = document.createElement('span');
        if (hasValue) {
          valueSpan.className = 'ao3sp-field-value';
          valueSpan.title = preview;
          valueSpan.textContent = preview;
        } else {
          valueSpan.className = 'ao3sp-field-empty';
          valueSpan.textContent = 'not available';
        }

        row.appendChild(cb);
        row.appendChild(nameSpan);
        row.appendChild(valueSpan);
        list.appendChild(row);

        cb.addEventListener('change', () => {
          Storage.set(savedKey, cb.checked);
          if (subList) subList.classList.toggle('ao3sp-sublist-hidden', !cb.checked);
          this.schedulePreviewUpdate();
        });

        // Sub-item checkboxes for multi-value array fields with >1 item
        let subList = null;
        if (def.multiValue && Array.isArray(rawVal) && rawVal.length > 1) {
          subList = document.createElement('div');
          subList.className = 'ao3sp-sublist' + (checked ? '' : ' ao3sp-sublist-hidden');

          rawVal.forEach((item, i) => {
            const subKey = `field-sub-${def.key}-${i}`;
            const subChecked = Storage.get(subKey, true);

            const subRow = document.createElement('label');
            subRow.className = 'ao3sp-sub-row';

            const subCb = document.createElement('input');
            subCb.type = 'checkbox';
            subCb.checked = subChecked;
            subCb.dataset.fieldSubKey = def.key;
            subCb.dataset.fieldSubIdx = String(i);
            subCb.dataset.fieldSubValue = item;

            const subLabel = document.createElement('span');
            subLabel.className = 'ao3sp-sub-label';
            subLabel.textContent = item;
            subLabel.title = item;

            subRow.appendChild(subCb);
            subRow.appendChild(subLabel);
            subList.appendChild(subRow);

            subCb.addEventListener('change', () => {
              Storage.set(subKey, subCb.checked);
              this.schedulePreviewUpdate();
            });
          });

          list.appendChild(subList);
        }
      });
    },

    getOptions() {
      const opts = { useChapter: this.getUseChapter() };
      const list = this.panel.querySelector('#ao3sp-fields-list');
      if (list) {
        list.querySelectorAll('input[type=checkbox][data-field-key]').forEach(cb => {
          opts[cb.dataset.fieldKey] = cb.checked;
        });

        // For multi-value fields, build filtered arrays from sub-item checkboxes.
        // filteredX is the subset of items whose sub-checkbox is checked.
        // null means "use all" (no sub-selection, e.g. only 1 item or no sub-row rendered).
        this._fieldDefs().filter(d => d.multiValue).forEach(def => {
          const subCbs = list.querySelectorAll(`input[data-field-sub-key="${def.key}"]`);
          if (subCbs.length > 0) {
            const filterKey = 'filtered' + def.dataKey[0].toUpperCase() + def.dataKey.slice(1);
            opts[filterKey] = Array.from(subCbs)
              .filter(sc => sc.checked)
              .map(sc => sc.dataset.fieldSubValue);
          }
        });
      }
      // Legacy aliases used by Clipboard.buildShareText
      opts.includeSummary = !!opts.showSummary;
      opts.includeTags = !!opts.showTags;
      return opts;
    },

    makeCardKey() {
      const o = this.getOptions();
      return JSON.stringify({ ...o, url: this.workData?.url, canonical: this.workData?.canonicalUrl });
    },

    updateInfo() {
      const titleEl = this.panel.querySelector('#ao3sp-info-title');
      const authorEl = this.panel.querySelector('#ao3sp-info-author');
      const statsEl = this.panel.querySelector('#ao3sp-info-stats');

      titleEl.textContent = this.workData.title || 'Untitled Work';
      authorEl.textContent = this.workData.authors.length
        ? `by ${this.workData.authors.map(a => a.name).join(', ')}`
        : 'by Anonymous';

      const bits = [];
      if (this.workData.wordCount) bits.push(`<span><b>${this.workData.wordCount}</b> words</span>`);
      if (this.workData.chapters) bits.push(`<span><b>${this.workData.chapters}</b> chapters</span>`);
      if (this.workData.rating) bits.push(`<span><b>${this.workData.rating}</b></span>`);
      statsEl.innerHTML = bits.join(' • ');
    },

    schedulePreviewUpdate() {
      // Debounce so rapid checkbox toggles only trigger one render
      if (this._previewTimer) clearTimeout(this._previewTimer);
      this._previewTimer = setTimeout(() => { this._previewTimer = null; this.updatePreview(); }, 80);
    },

    updatePreview() {
      if (!this.workData) return;
      const key = this.makeCardKey();
      const canvas = this.ensureCardCanvas(key);

      const previewEl = this.panel.querySelector('#ao3sp-preview-canvas');
      // Scale the actual high-dpr canvas down to fit the preview column
      const src = canvas;
      // Draw onto preview canvas at display resolution
      const colW = this.panel.querySelector('.ao3sp-preview-col').clientWidth - 24;
      const scale = Math.min(1, colW / (CONFIG.CARD_DIMENSIONS.width));
      const dispW = Math.round(CONFIG.CARD_DIMENSIONS.width * scale);
      const dispH = Math.round((canvas.height / (canvas.width / CONFIG.CARD_DIMENSIONS.width)) * scale);

      previewEl.width = canvas.width;
      previewEl.height = canvas.height;
      previewEl.style.width = `${dispW}px`;
      previewEl.style.height = `${dispH}px`;

      const pCtx = previewEl.getContext('2d');
      pCtx.drawImage(src, 0, 0);
    },

    refreshCardKey() {
      this.lastCardKey = '';
    },

    ensureCardCanvas(key) {
      const k = key || this.makeCardKey();
      if (this.lastCardCanvas && this.lastCardKey === k) return this.lastCardCanvas;

      const o = this.getOptions();
      const canvas = CardRenderer.generateCard(this.workData, {
        useCurrentChapter: o.useChapter,
        ...o,
        width: CONFIG.CARD_DIMENSIONS.width,
        qrSize: CONFIG.QR_SIZE
      });

      this.lastCardCanvas = canvas;
      this.lastCardKey = k;
      return canvas;
    },

    downloadCard() {
      const canvas = this.ensureCardCanvas();
      const link = document.createElement('a');
      const safeTitle = (this.workData.title || 'work').replace(/[^a-z0-9]/gi, '_').substring(0, 50);
      link.download = `ao3_${safeTitle}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      this.showToast('Card downloaded');
    },

    async copyCard() {
      const canvas = this.ensureCardCanvas();
      const btn = this.panel.querySelector('#ao3sp-copy-card-btn');
      try {
        const blob = await new Promise((resolve, reject) => {
          canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
        });
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        this.flashButtonSuccess(btn, 'Copied!');
        this.showToast('Card copied to clipboard');
      } catch (err) {
        console.error('[AO3 Share] Copy card failed:', err);
        this.showToast('Copy failed – try downloading instead');
      }
    },

    async copyShareText() {
      const o = this.getOptions();
      const txt = Clipboard.buildShareText(this.workData, {
        includeSummary: o.includeSummary,
        includeTags: o.includeTags,
        useChapter: o.useChapter
      });
      const success = await Clipboard.copyText(txt);
      const btn = this.panel.querySelector('#ao3sp-copy-text-btn');
      if (success) { this.flashButtonSuccess(btn, 'Copied!'); this.showToast('Text copied'); }
      else this.showToast('Copy failed');
    },

    async copyLink() {
      const o = this.getOptions();
      const url = o.useChapter && this.workData.isChapter ? this.workData.url : DataExtractor.getCleanWorkUrl(this.workData);
      const success = await Clipboard.copyText(url);
      const btn = this.panel.querySelector('#ao3sp-copy-link-btn');
      if (success) { this.flashButtonSuccess(btn, 'Copied!'); this.showToast('Link copied'); }
      else this.showToast('Copy failed');
    },

    /**
     * Flash a success state on a button
     * @param {HTMLElement} btn - Button element
     * @param {string} label - Success label text
     */
    flashButtonSuccess(btn, label) {
      const original = btn.innerHTML;
      btn.classList.add('ao3sp-btn-success');
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        ${label}
      `;
      setTimeout(() => {
        btn.classList.remove('ao3sp-btn-success');
        btn.innerHTML = original;
      }, 1400);
    },

    /**
     * Display a temporary toast notification
     * @param {string} message - Message to display
     */
    showToast(message) {
      // Remove existing toast if present
      const existing = document.querySelector('.ao3sp-toast');
      if (existing) existing.remove();

      const toast = document.createElement('div');
      toast.className = 'ao3sp-toast';
      toast.innerHTML = `<span class="ao3sp-dot" aria-hidden="true"></span><span>${message}</span>`;
      document.body.appendChild(toast);

      // Animate in
      requestAnimationFrame(() => toast.classList.add('ao3sp-visible'));
      
      // Auto-dismiss after delay
      setTimeout(() => {
        toast.classList.remove('ao3sp-visible');
        setTimeout(() => toast.remove(), 250);
      }, 1800);
    }
  };

  // ============================================================
  // INITIALIZATION
  // Validates URL and initializes UI when DOM is ready
  // ============================================================
  
  /**
   * Initialize the share panel
   * Only runs on work and chapter pages
   */
  function init() {
    // Only activate on work and chapter pages
    if (!window.location.pathname.match(/\/(works|chapters)\/\d+/)) return;

    function mountUI() {
      try {
        UI.init();
      } catch (error) {
        console.error('[AO3 Share] Initialization failed:', error);
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mountUI);
    } else {
      mountUI();
    }
  }

  // Start the script
  init();
})();
