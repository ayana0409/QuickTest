# Hướng Dẫn Sửa Lỗi Hiển Thị Thứ Tự Test Case Trong Bruno Extension

Tài liệu này ghi lại chi tiết nguyên nhân, vị trí file và cách khắc phục tình trạng danh sách request/thư mục trong **Bruno Extension (VS Code / Antigravity IDE)** bị đảo lộn thứ tự (ví dụ: folder `06-Proctoring` hiển thị trước `02-Teacher-Exams`, các test case không theo thứ tự số học `1.01`, `1.02`...).

---

## 1. Triệu Chứng (Symptoms)

- Trong cửa sổ **Collection Runner** của Bruno, danh sách các request không đi tuần tự từ `01` đến `10`, mà bị nhảy cóc:
  - `01-Auth-IAM` (1.09, 1.10, 1.11, 1.12)
  - `06-Proctoring` (6.01, 6.02, ...)  *(Bị đẩy lên trước 02)*
  - `07-Media-Upload`
  - `02-Teacher-Exams`
  - `10-Student-History`
  - `05-Teacher-Grading`
  - `04-Candidate-Session`
  - `09-Admin-Management`
  - `03-Teacher-Questions`
  - `08-Question-Centric-Grading`

---

## 2. Nguyên Nhân Kỹ Thuật (Root Cause)

1. **Sắp xếp theo độ dài chuỗi ký tự (`length - length`)**:
   Trong `dist/extension.js`, hai hàm quét khởi tạo `performInitialScan` và `loadFullCollection` sắp xếp mảng đường dẫn thư mục bằng:
   ```javascript
   pt.sort((It, Ot) => It.length - Ot.length);
   // và
   yt.sort((zt, Gt) => zt.length - Gt.length);
   ```
   Do tiêu chí `It.length - Ot.length`, các thư mục có tên ngắn hơn luôn đứng trước các thư mục có tên dài hơn:
   - `01-Auth-IAM`: 11 ký tự
   - `06-Proctoring`: 13 ký tự
   - `07-Media-Upload`: 15 ký tự
   - `02-Teacher-Exams`: 16 ký tự
   - `03-Teacher-Questions`: 21 ký tự
   - `08-Question-Centric-Grading`: 27 ký tự

2. **Hàm quét `readdirSync` không sắp xếp tự nhiên**:
   Hàm `scanDirectoryRecursive` đọc tệp từ ổ đĩa qua `readdirSync` mà không sắp xếp theo thứ tự số học (natural sort).

3. **Collection Runner UI Component (`async/1645.js`) không sort khi duyệt cây**:
   Hàm `v()` trong component Runner duyệt trực tiếp mảng `collection.items` mà không sắp xếp lại theo `seq` hoặc tên tự nhiên (`{ numeric: true }`).

---

## 3. Cách Sửa Nhanh Nhất (1 Lệnh Tự Động)

Dự án đã tích hợp sẵn script tự động dò tìm thư mục extension và vá lại toàn bộ các file:

Chỉ cần mở terminal tại thư mục gốc của dự án (`d:\Workspace\QuickTest`) và chạy:

```bash
npm run patch-bruno
```

*Hoặc chạy trực tiếp:*
```bash
node scripts/patch-bruno-extension.js
```

Sau khi chạy xong, mở Command Palette trong IDE (`Ctrl+Shift+P` hoặc `F1`) và gõ:
```text
Developer: Reload Window
```

---

## 4. Hướng Dẫn Sửa Thủ Công (Manual Patch Guide)

Nếu extension được cập nhật phiên bản mới hoặc chạy trên máy khác mà không dùng npm script:

### Đường dẫn extension trên máy:
```text
C:\Users\<Username>\.antigravity-ide\extensions\bruno-api-client.bruno-6.0.0-universal\
(hoặc ~/.vscode/extensions/bruno-api-client.bruno-*)
```

---

### Tệp 1: `dist/extension.js`

1. **Sửa `performInitialScan`**:
   - **Tìm kiếm**:
     ```javascript
     pt.sort((It,Ot)=>It.length-Ot.length);for(let It of pt)await this.handleDirectoryAdd(It,ct,ut);let gt=[],yt=[];for(let It of mt)yJ(It,ut)||ez(It,ut)||i9(It,ut)||rz(It,ut)||tz(It,ut)?gt.push(It):yt.push(It);
     ```
   - **Thay bằng**:
     ```javascript
     pt.sort((It,Ot)=>(It.split(/[\\/]/).length-Ot.split(/[\\/]/).length)||It.localeCompare(Ot,void 0,{numeric:!0}));for(let It of pt)await this.handleDirectoryAdd(It,ct,ut);let gt=[],yt=[];for(let It of mt)yJ(It,ut)||ez(It,ut)||i9(It,ut)||rz(It,ut)||tz(It,ut)?gt.push(It):yt.push(It);yt.sort((It,Ot)=>It.localeCompare(Ot,void 0,{numeric:!0}));
     ```

2. **Sửa `loadFullCollection`**:
   - **Tìm kiếm**:
     ```javascript
     yt.sort((zt,Gt)=>zt.length-Gt.length);for(let zt of yt)await this.handleDirectoryAddWithSender(zt,ct,ut,ht);let vt=[],bt=[];for(let zt of gt)yJ(zt,ut)||ez(zt,ut)||i9(zt,ut)||rz(zt,ut)||tz(zt,ut)?vt.push(zt):bt.push(zt);
     ```
   - **Thay bằng**:
     ```javascript
     yt.sort((zt,Gt)=>(zt.split(/[\\/]/).length-Gt.split(/[\\/]/).length)||zt.localeCompare(Gt,void 0,{numeric:!0}));for(let zt of yt)await this.handleDirectoryAddWithSender(zt,ct,ut,ht);let vt=[],bt=[];for(let zt of gt)yJ(zt,ut)||ez(zt,ut)||i9(zt,ut)||rz(zt,ut)||tz(zt,ut)?vt.push(zt):bt.push(zt);bt.sort((zt,Gt)=>zt.localeCompare(Gt,void 0,{numeric:!0}));
     ```

3. **Sửa `scanDirectoryRecursive`**:
   - **Tìm kiếm**:
     ```javascript
     let gt=mg.default.readdirSync(pt,{withFileTypes:!0});
     ```
   - **Thay bằng**:
     ```javascript
     let gt=mg.default.readdirSync(pt,{withFileTypes:!0}).sort((It,Ot)=>It.name.localeCompare(Ot.name,void 0,{numeric:!0}));
     ```

4. **Bổ sung `{ numeric: true }` cho các lệnh `localeCompare` còn lại**:
   - `Tt.name.localeCompare(Mt.name)` → `Tt.name.localeCompare(Mt.name,void 0,{numeric:!0})`
   - `vt.name.localeCompare(bt.name)` → `vt.name.localeCompare(bt.name,void 0,{numeric:!0})`
   - `St.name.localeCompare(wt.name)` → `St.name.localeCompare(wt.name,void 0,{numeric:!0})`

---

### Tệp 2: `dist/webview/static/js/async/1645.js` (Collection Runner UI)

- **Tìm kiếm**:
  ```javascript
  v=(0,l.useCallback)((e,t)=>{let s=[],r=["http-request","graphql-request"],l=t=>{(null==t?void 0:t.length)&&t.forEach(t=>{var a;if((0,c.Y2)(t)&&r.includes(t.type)&&!t.isTransient){let r=i.Ay.relative(e.pathname,i.Ay.dirname(t.pathname));s.push({...t,folderPath:("."!==r?r:"").replace(/\\/g,"/")})}(null==(a=t.items)?void 0:a.length)&&l(t.items)})};return l(t),s},[]);
  ```
- **Thay bằng**:
  ```javascript
  v=(0,l.useCallback)((e,t)=>{let s=[],r=["http-request","graphql-request"],l=t=>{(null==t?void 0:t.length)&&[...t].sort((A,B)=>{let aF=Boolean(A.items),bF=Boolean(B.items);if(aF!==bF)return aF?-1:1;let aS=typeof A.seq=="number"&&Number.isFinite(A.seq)?A.seq:null,bS=typeof B.seq=="number"&&Number.isFinite(B.seq)?B.seq:null;if(aS!==null&&bS!==null&&aS!==bS)return aS-bS;return(A.name||"").localeCompare(B.name||"",void 0,{numeric:!0})}).forEach(t=>{var a;if((0,c.Y2)(t)&&r.includes(t.type)&&!t.isTransient){let r=i.Ay.relative(e.pathname,i.Ay.dirname(t.pathname));s.push({...t,folderPath:("."!==r?r:"").replace(/\\/g,"/")})}(null==(a=t.items)?void 0:a.length)&&l(t.items)})};return l(t),s},[]);
  ```

---

## 5. Kiểm Tra Cú Pháp Sau Khi Sửa

Chạy lệnh sau để đảm bảo không bị lỗi syntax JavaScript:
```bash
node -c "C:\Users\<Username>\.antigravity-ide\extensions\bruno-api-client.bruno-6.0.0-universal\dist\extension.js"
node -c "C:\Users\<Username>\.antigravity-ide\extensions\bruno-api-client.bruno-6.0.0-universal\dist\webview\static\js\async\1645.js"
```
Nếu lệnh chạy không in ra lỗi nào là thành công!
