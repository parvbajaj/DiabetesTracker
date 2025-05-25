// Use deployed Render backend for API base
const API_BASE = "https://diabetestracker.onrender.com";

const STEPS = [
  'FASTING',
  'BREAKFAST INSULIN',
  '2 HRS POST BREAKFAST',
  'PRE LUNCH',
  'LUNCH INSULIN',
  '2 HR POST LUNCH',
  'PRE DINNER',
  'DINNER INSULIN',
  '2 HR POST DINNER',
  'Lantus'
];

const INSULIN_FIELDS = [
  'BREAKFAST INSULIN',
  'LUNCH INSULIN',
  'DINNER INSULIN',
  'Lantus'
];

async function fetchCurrentStep() {
  try {
    const res = await fetch(`${API_BASE}/current-step`);
    if (!res.ok) throw new Error("Network response was not ok");
    return res.json();
  } catch (err) {
    return { step: null, error: "Unable to connect to server!" };
  }
}

async function submitStep(step, value) {
  // Auto-append " units" for insulin fields if not present
  if (INSULIN_FIELDS.includes(step) && value && !/unit/i.test(value)) {
    value = value + " units";
  }
  await fetch(`${API_BASE}/submit-step`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ step, value })
  });
}

async function fetchEditToday() {
  const res = await fetch(`${API_BASE}/edit-today`);
  return res.json();
}

async function saveEditToday(data) {
  // Auto-append " units" for insulin fields if not present
  INSULIN_FIELDS.forEach(field => {
    if (data[field] && !/unit/i.test(data[field])) {
      data[field] = data[field] + " units";
    }
  });
  const res = await fetch(`${API_BASE}/edit-today`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  return res.json();
}

async function resetToday() {
  const res = await fetch(`${API_BASE}/reset-today`, { method: "POST" });
  return res.json();
}

async function fetchShowTable() {
  const res = await fetch(`${API_BASE}/show`);
  return res.json();
}

function renderShowTable(tableArea, columns, rows) {
  let html = "<table><thead><tr>";
  columns.forEach(col => html += `<th>${col}</th>`);
  html += "</tr></thead><tbody>";
  rows.forEach(row => {
    html += "<tr>";
    row.forEach(cell => html += `<td>${cell}</td>`);
    html += "</tr>";
  });
  html += "</tbody></table>";
  tableArea.innerHTML = html;
}

async function main() {
  const stepLabel = document.getElementById('step-label');
  const stepInput = document.getElementById('step-input');
  const submitBtn = document.getElementById('submit-btn');
  const doneMsg = document.getElementById('done-msg');
  const downloadLink = document.getElementById('download-link');
  const editBtn = document.getElementById('edit-btn');
  const resetBtn = document.getElementById('reset-btn');
  const showBtn = document.getElementById('show-btn');

  const editForm = document.getElementById('edit-today-form');
  const editFields = document.getElementById('edit-fields');
  const saveEditBtn = document.getElementById('save-edit-btn');
  const closeEditBtn = document.getElementById('close-edit-btn');
  const showTableArea = document.getElementById('show-table-area');

  let showTableVisible = false;

  async function updateUI() {
    const { step, error } = await fetchCurrentStep();
    if (error) {
      stepLabel.textContent = error;
      stepInput.style.display = 'none';
      submitBtn.style.display = 'none';
      doneMsg.style.display = 'none';
      return;
    }
    if (step) {
      stepLabel.textContent = `Enter ${step}`;
      stepInput.value = '';
      stepInput.style.display = '';
      submitBtn.style.display = '';
      doneMsg.style.display = 'none';
      stepInput.focus();
    } else {
      stepLabel.textContent = '';
      stepInput.style.display = 'none';
      submitBtn.style.display = 'none';
      doneMsg.style.display = '';
      doneMsg.textContent = 'All steps completed for today!';
    }
    // Hide the table if step changes
    showTableArea.style.display = 'none';
    showTableVisible = false;
    showBtn.innerHTML = `<i class="bi bi-table"></i> Show`;
  }

  submitBtn.addEventListener('click', async () => {
    const { step } = await fetchCurrentStep();
    const value = stepInput.value.trim();
    if (!value) return;
    await submitStep(step, value);
    await updateUI();
  });

  stepInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') submitBtn.click();
  });

  downloadLink.href = `${API_BASE}/download`;

  // Edit Today logic
  editBtn.addEventListener('click', async () => {
    const data = await fetchEditToday();
    editFields.innerHTML = '';
    STEPS.forEach(step => {
      const row = document.createElement('div');
      row.className = 'edit-form-row';
      row.innerHTML = `
        <label>${step}:</label>
        <input type="text" name="${step}" value="${data[step] || ""}" />
      `;
      editFields.appendChild(row);
    });
    editForm.style.display = '';
    document.getElementById('step-area').style.display = 'none';
    showTableArea.style.display = 'none';
    showTableVisible = false;
    showBtn.innerHTML = `<i class="bi bi-table"></i> Show`;
  });

  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = {};
    Array.from(editFields.querySelectorAll('input')).forEach(input => {
      formData[input.name] = input.value.trim();
    });
    await saveEditToday(formData);
    editForm.style.display = 'none';
    document.getElementById('step-area').style.display = '';
    await updateUI();
  });

  closeEditBtn.addEventListener('click', () => {
    editForm.style.display = 'none';
    document.getElementById('step-area').style.display = '';
  });

  resetBtn.addEventListener('click', async () => {
    if(confirm("Are you sure you want to reset today's entries? This cannot be undone.")) {
      await resetToday();
      await updateUI();
    }
  });

  showBtn.addEventListener('click', async () => {
    if (!showTableVisible) {
      const data = await fetchShowTable();
      renderShowTable(showTableArea, data.columns, data.rows);
      showTableArea.style.display = '';
      showBtn.innerHTML = `<i class="bi bi-x-circle"></i> Hide`;
      editForm.style.display = 'none';
      document.getElementById('step-area').style.display = '';
      window.scrollTo({ top: showTableArea.offsetTop - 20, behavior: "smooth" });
      showTableVisible = true;
    } else {
      showTableArea.style.display = 'none';
      showBtn.innerHTML = `<i class="bi bi-table"></i> Show`;
      showTableVisible = false;
    }
  });

  await updateUI();
}

window.onload = main;