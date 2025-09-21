import api from "./api.js";

const taskList = document.querySelector(".task-list");
const input = document.querySelector(".input");
const addTaskBtn = document.querySelector(".submit-btn");

// Hàm để escape HTML nhằm ngăn ngừa XSS
function escapeHTML(html) {
  const div = document.createElement("div");
  div.innerText = html; // Gán nội dung vào thẻ div để tự động escape các ký tự HTML
  return div.innerHTML; // Trả về nội dung đã được escape
}

// Hàm hiển thị loading cho danh sách
function showListLoading() {
  taskList.innerHTML = '<li class="loading-message">Loading tasks...</li>';
}

// Hàm hiển thị loading cho button
function setButtonLoading(button, isLoading, originalText, loadingText) {
  if (isLoading) {
    button.disabled = true;
    button.setAttribute('data-original-text', originalText || button.textContent);
    button.textContent = loadingText || 'Loading...';
    button.classList.add('loading');
  } else {
    button.disabled = false;
    button.textContent = button.getAttribute('data-original-text') || originalText;
    button.classList.remove('loading');
    button.removeAttribute('data-original-text');
  }
}

const onAddTask = async () => {
  try {
    // Hiển thị loading cho add button
    setButtonLoading(addTaskBtn, true, 'Add Task', 'Adding...');
    
    const tasks = await getTodos();
    const isDuplicated = tasks.some(
      (todo) =>
        todo.title.toLowerCase().trim() === input.value.toLowerCase().trim()
    );
    if (isDuplicated) {
      alert("This task existed!");
      return;
    }
    await postTodo();
    
    // Clear input after successful add
    input.value = '';
    
    // Re-render danh sách
    await onMount();
    
  } catch (error) {
    console.log(error);
    alert("Error adding task. Please try again.");
    throw error;
  } finally {
    // Tắt loading cho add button
    setButtonLoading(addTaskBtn, false);
  }
};

const onEditTask = async (id, element) => {
  const taskItem = element.closest(".task-item");
  const span = taskItem.querySelector(".task-title");
  const oldValue = span.innerText;
  const actionDiv = taskItem.querySelector(".task-action");

  // Tạo input thay thế span
  const input = document.createElement("input");
  input.type = "text";
  input.value = oldValue;
  input.classList.add("edit-input");

  // Focus vào input và select all text
  setTimeout(() => {
    input.focus();
    input.select();
  }, 0);

  // Tạo container cho task content (input + buttons)
  const taskContent = document.createElement("div");
  taskContent.classList.add("task-content");

  // Tạo container cho các nút Save/Cancel
  const buttonContainer = document.createElement("div");
  buttonContainer.classList.add("edit-buttons");

  // Tạo nút Save
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.innerText = "Save";
  saveBtn.classList.add("task-btn", "save");

  // Tạo nút Cancel
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.innerText = "Cancel";
  cancelBtn.classList.add("task-btn", "cancel");

  // Thêm các nút vào container
  buttonContainer.appendChild(saveBtn);
  buttonContainer.appendChild(cancelBtn);

  // Setup layout cho editing mode
  taskContent.appendChild(input);
  taskContent.appendChild(buttonContainer);

  // Thay thế span bằng taskContent và ẩn action buttons
  span.replaceWith(taskContent);
  actionDiv.style.display = "none";
  taskItem.classList.add("editing");

  // Hàm restore về trạng thái ban đầu
  const restoreOriginalState = () => {
    taskContent.replaceWith(span);
    span.innerText = oldValue;
    actionDiv.style.display = "flex";
    taskItem.classList.remove("editing");
  };

  // Hàm xử lý save
  const handleSave = async () => {
    const newTitle = input.value.trim();

    if (!newTitle) {
      alert("Title cannot be empty!");
      input.focus();
      return;
    }

    try {
      // Hiển thị loading cho save button
      setButtonLoading(saveBtn, true, 'Save', 'Saving...');
      cancelBtn.disabled = true;

      const tasks = await getTodos();
      const isDuplicated = tasks.some(
        (todo) =>
          todo.title.toLowerCase().trim() === newTitle.toLowerCase().trim() &&
          todo.id != id
      );

      if (isDuplicated) {
        alert("This task already exists!");
        input.focus();
        return;
      }

      await putTitleTodo(id, escapeHTML(newTitle));
      onMount(); // Re-render danh sách
    } catch (error) {
      console.error("Error updating task:", error);
      alert("Error updating task. Please try again.");
    } finally {
      // Tắt loading cho các buttons
      setButtonLoading(saveBtn, false);
      cancelBtn.disabled = false;
    }
  };

  // Event listeners
  saveBtn.addEventListener("click", handleSave);
  cancelBtn.addEventListener("click", restoreOriginalState);

  // Enter để save, Escape để cancel
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      restoreOriginalState();
    }
  });

  // Click outside để cancel
  const handleClickOutside = (e) => {
    if (!taskItem.contains(e.target)) {
      restoreOriginalState();
      document.removeEventListener("click", handleClickOutside);
    }
  };

  // Delay để tránh trigger ngay lập tức
  setTimeout(() => {
    document.addEventListener("click", handleClickOutside);
  }, 100);
};

const onToggleDoneTask = async (id, element) => {
  try {
    // Hiển thị loading cho done button
    const originalText = element.textContent;
    setButtonLoading(element, true, originalText, 'Updating...');
    
    await putCompleteTodo(id);
    
    // Re-render danh sách
    await onMount();
    
  } catch (error) {
    console.log(error);
    alert("Error updating task. Please try again.");
  } finally {
    // Loading sẽ được tắt khi re-render
  }
};

const onDeleteTask = async (id, element) => {
  if (confirm("Are you sure to delete this task?")) {
    try {
      // Hiển thị loading cho delete button
      setButtonLoading(element, true, 'Delete', 'Deleting...');
      
      // Người dùng bấm OK
      await deleteTodo(id);
      
      // Re-render danh sách
      await onMount();
      
    } catch (error) {
      console.log(error);
      alert("Error deleting task. Please try again.");
      // Tắt loading nếu có lỗi
      setButtonLoading(element, false);
    }
  }
};

// Hiển thị danh sách công việc
function renderTasks(tasks) {
  if (!tasks.length) {
    taskList.innerHTML = '<li class="empty-message">No tasks available.</li>'; // Hiển thị thông báo nếu danh sách rỗng
    return;
  }

  const html = tasks
    .map(
      (task, index) => `
    <li class="task-item ${
      task.completed ? "completed" : "" // Thêm class "completed" nếu công việc đã hoàn thành
    }" data-index="${index}">
        <span class="task-title">${escapeHTML(
          task.title
        )}</span> <!-- Escape tiêu đề công việc -->
        <div class="task-action">
            <button type="button" data-id=${
              task.id
            } class="task-btn edit">Edit</button> <!-- Nút sửa -->
            <button type="button" data-id=${task.id} class="task-btn done">${
        task.completed ? "Mark as undone" : "Mark as done"
      }</button> <!-- Nút hoàn thành -->
            <button type="button" data-id=${
              task.id
            } class="task-btn delete">Delete</button> <!-- Nút xóa -->
        </div>
    </li>
`
    )
    .join(""); // Kết hợp tất cả các phần tử thành một chuỗi HTML

  taskList.innerHTML = html; // Chèn HTML vào danh sách

  document.querySelectorAll(".task-btn.edit").forEach((element) => {
    const id = element.dataset.id;
    element.addEventListener("click", () => onEditTask(id, element));
  });

  document.querySelectorAll(".task-btn.done").forEach((element) => {
    const id = element.dataset.id;
    element.addEventListener("click", () => onToggleDoneTask(id, element));
  });

  document.querySelectorAll(".task-btn.delete").forEach((element) => {
    const id = element.dataset.id;
    element.addEventListener("click", () => onDeleteTask(id, element));
  });
}

addTaskBtn.addEventListener("click", onAddTask);

// Xử lý Enter key cho input
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    onAddTask();
  }
});

const getTodos = async () => {
  try {
    const response = await api.get("/todos");
    return response.data;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const postTodo = async () => {
  try {
    const response = await api.post("/todos", {
      title: escapeHTML(input.value),
      completed: false,
    });
    return response.data;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const putCompleteTodo = async (id) => {
  try {
    const todoFind = await api.get(`/todos/${id}`);
    const data = todoFind.data;
    await api.put(`/todos/${id}`, {
      ...data,
      completed: !data.completed,
    });
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const putTitleTodo = async (id, newTitle) => {
  try {
    const todoFind = await api.get(`/todos/${id}`);
    const data = todoFind.data;
    await api.put(`/todos/${id}`, {
      ...data,
      title: newTitle,
    });
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const deleteTodo = async (id) => {
  try {
    await api.delete(`/todos/${id}`);
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const onMount = async () => {
  try {
    // Hiển thị loading khi tải danh sách
    showListLoading();
    
    const tasks = await getTodos();
    console.log(tasks);
    renderTasks(tasks);
  } catch (error) {
    console.log(error);
    taskList.innerHTML = '<li class="error-message">Error loading tasks. Please refresh the page.</li>';
  }
};

document.addEventListener("DOMContentLoaded", () => onMount());