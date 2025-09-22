// Import API module để gọi các endpoint
import api from "./api.js";

// Lấy các element từ DOM
const taskList = document.querySelector(".task-list"); // Container chứa danh sách công việc
const input = document.querySelector(".input"); // Input để nhập tên công việc
const addTaskBtn = document.querySelector(".submit-btn"); // Button thêm công việc mới

// Hàm để escape HTML nhằm ngăn ngừa XSS attacks
function escapeHTML(html) {
  const div = document.createElement("div");
  div.innerText = html; // Gán nội dung vào thẻ div để tự động escape các ký tự HTML
  return div.innerHTML; // Trả về nội dung đã được escape
}

// Hàm hiển thị trạng thái loading cho danh sách công việc
function showListLoading() {
  taskList.innerHTML = '<li class="loading-message">Loading tasks...</li>';
}

// Hàm quản lý trạng thái loading của các button
function setButtonLoading(button, isLoading, originalText, loadingText) {
  if (isLoading) {
    // Bật loading: disable button và thay đổi text
    button.disabled = true;
    button.setAttribute(
      "data-original-text",
      originalText || button.textContent
    );
    button.textContent = loadingText || "Loading...";
    button.classList.add("loading");
  } else {
    // Tắt loading: enable button và khôi phục text gốc
    button.disabled = false;
    button.textContent =
      button.getAttribute("data-original-text") || originalText;
    button.classList.remove("loading");
    button.removeAttribute("data-original-text");
  }
}

// Hàm xử lý thêm công việc mới
const onAddTask = async () => {
  try {
    // Hiển thị loading cho add button
    setButtonLoading(addTaskBtn, true, "Add Task", "Adding...");

    // Lấy danh sách công việc hiện tại
    const tasks = await getTodos();
    
    // Kiểm tra xem công việc đã tồn tại chưa (so sánh không phân biệt hoa thường)
    const isDuplicated = tasks.some(
      (todo) =>
        todo.title.toLowerCase().trim() === input.value.toLowerCase().trim()
    );
    
    if (isDuplicated) {
      alert("This task existed!");
      return;
    }
    
    // Gọi API để thêm công việc mới
    await postTodo();

    // Xóa nội dung input sau khi thêm thành công
    input.value = "";

    // Tải lại và hiển thị danh sách mới
    await onMount();
  } catch (error) {
    console.log(error);
    alert("Error adding task. Please try again.");
    throw error;
  } finally {
    // Luôn tắt loading khi kết thúc (dù thành công hay lỗi)
    setButtonLoading(addTaskBtn, false);
  }
};

// Hàm xử lý chỉnh sửa công việc
const onEditTask = async (id, element) => {
  // Tìm các element cần thiết
  const taskItem = element.closest(".task-item"); // Li chứa toàn bộ task
  const span = taskItem.querySelector(".task-title"); // Span chứa tiêu đề
  const oldValue = span.innerText; // Lưu giá trị cũ
  const actionDiv = taskItem.querySelector(".task-action"); // Div chứa các button

  // Tạo input để chỉnh sửa
  const input = document.createElement("input");
  input.type = "text";
  input.value = oldValue;
  input.classList.add("edit-input");

  // Focus vào input và select toàn bộ text
  setTimeout(() => {
    input.focus();
    input.select();
  }, 0);

  // Tạo container cho nội dung đang chỉnh sửa
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

  // Setup layout cho chế độ chỉnh sửa
  taskContent.appendChild(input);
  taskContent.appendChild(buttonContainer);

  // Thay thế span bằng form chỉnh sửa và ẩn các action buttons
  span.replaceWith(taskContent);
  actionDiv.style.display = "none";
  taskItem.classList.add("editing"); // Thêm class để styling

  // Hàm khôi phục về trạng thái ban đầu (hủy chỉnh sửa)
  const restoreOriginalState = () => {
    taskContent.replaceWith(span); // Thay form bằng span gốc
    span.innerText = oldValue; // Khôi phục giá trị cũ
    actionDiv.style.display = "flex"; // Hiện lại action buttons
    taskItem.classList.remove("editing"); // Xóa class editing
  };

  // Hàm xử lý lưu thay đổi
  const handleSave = async () => {
    const newTitle = input.value.trim(); // Lấy giá trị mới và trim khoảng trắng

    // Kiểm tra input không được để trống
    if (!newTitle) {
      alert("Title cannot be empty!");
      input.focus();
      return;
    }

    try {
      // Hiển thị loading cho save button
      setButtonLoading(saveBtn, true, "Save", "Saving...");
      cancelBtn.disabled = true; // Disable cancel button khi đang save

      // Lấy danh sách công việc để kiểm tra trùng lặp
      const tasks = await getTodos();
      const isDuplicated = tasks.some(
        (todo) =>
          todo.title.toLowerCase().trim() === newTitle.toLowerCase().trim() &&
          todo.id != id // Không tính task hiện tại
      );

      if (isDuplicated) {
        alert("This task already exists!");
        input.focus();
        return;
      }

      // Gọi API để cập nhật tiêu đề
      await putTitleTodo(id, escapeHTML(newTitle));
      onMount(); // Tải lại danh sách
    } catch (error) {
      console.error("Error updating task:", error);
      alert("Error updating task. Please try again.");
    } finally {
      // Tắt loading cho các buttons
      setButtonLoading(saveBtn, false);
      cancelBtn.disabled = false;
    }
  };

  // Gắn event listeners cho các buttons
  saveBtn.addEventListener("click", handleSave);
  cancelBtn.addEventListener("click", restoreOriginalState);

  // Xử lý phím tắt: Enter để save, Escape để cancel
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      restoreOriginalState();
    }
  });

  // Xử lý click outside để hủy chỉnh sửa
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

// Hàm xử lý đánh dấu hoàn thành/chưa hoàn thành công việc
const onToggleDoneTask = async (id, element) => {
  try {
    // Hiển thị loading cho done button
    const originalText = element.textContent;
    setButtonLoading(element, true, originalText, "Updating...");

    // Gọi API để toggle trạng thái completed
    await putCompleteTodo(id);

    // Tải lại danh sách để cập nhật UI
    await onMount();
  } catch (error) {
    console.log(error);
    alert("Error updating task. Please try again.");
  } finally {
    // Loading sẽ được tắt khi re-render xong
  }
};

// Hàm xử lý xóa công việc
const onDeleteTask = async (id, element) => {
  // Xác nhận trước khi xóa
  if (confirm("Are you sure to delete this task?")) {
    try {
      // Hiển thị loading cho delete button
      setButtonLoading(element, true, "Delete", "Deleting...");

      // Gọi API để xóa task
      await deleteTodo(id);

      // Tải lại danh sách
      await onMount();
    } catch (error) {
      console.log(error);
      alert("Error deleting task. Please try again.");
      // Tắt loading nếu có lỗi (vì không re-render)
      setButtonLoading(element, false);
    }
  }
};

// Hàm hiển thị danh sách công việc ra HTML
function renderTasks(tasks) {
  // Hiển thị thông báo nếu không có task nào
  if (!tasks.length) {
    taskList.innerHTML = '<li class="empty-message">No tasks available.</li>';
    return;
  }

  // Tạo HTML cho từng task
  const html = tasks
    .map(
      (task, index) => `
    <li class="task-item ${
      task.completed ? "completed" : "" // Thêm class "completed" nếu đã hoàn thành
    }" data-index="${index}">
        <span class="task-title">${escapeHTML(
          task.title
        )}</span> <!-- Escape HTML để bảo mật -->
        <div class="task-action">
            <button type="button" data-id=${
              task.id
            } class="task-btn edit">Edit</button> <!-- Nút chỉnh sửa -->
            <button type="button" data-id=${task.id} class="task-btn done">${
        task.completed ? "Mark as undone" : "Mark as done" // Text thay đổi theo trạng thái
      }</button> <!-- Nút toggle hoàn thành -->
            <button type="button" data-id=${
              task.id
            } class="task-btn delete">Delete</button> <!-- Nút xóa -->
        </div>
    </li>
`
    )
    .join(""); // Nối tất cả HTML thành một chuỗi

  // Chèn HTML vào container
  taskList.innerHTML = html;

  // Gắn event listeners cho tất cả các nút Edit
  document.querySelectorAll(".task-btn.edit").forEach((element) => {
    const id = element.dataset.id; // Lấy id từ data attribute
    element.addEventListener("click", () => onEditTask(id, element));
  });

  // Gắn event listeners cho tất cả các nút Done/Undone
  document.querySelectorAll(".task-btn.done").forEach((element) => {
    const id = element.dataset.id;
    element.addEventListener("click", () => onToggleDoneTask(id, element));
  });

  // Gắn event listeners cho tất cả các nút Delete
  document.querySelectorAll(".task-btn.delete").forEach((element) => {
    const id = element.dataset.id;
    element.addEventListener("click", () => onDeleteTask(id, element));
  });
}

// Gắn event listener cho nút Add Task
addTaskBtn.addEventListener("click", onAddTask);

// Xử lý phím Enter trong input để thêm task
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    onAddTask();
  }
});

// === CÁC HÀM GỌI API ===

// Lấy danh sách tất cả công việc
const getTodos = async () => {
  try {
    const response = await api.get("/todos");
    return response.data; // Trả về dữ liệu tasks
  } catch (error) {
    console.log(error);
    throw error; // Ném lại lỗi để caller xử lý
  }
};

// Tạo công việc mới
const postTodo = async () => {
  try {
    const response = await api.post("/todos", {
      title: escapeHTML(input.value), // Escape HTML trước khi gửi
      completed: false, // Mặc định là chưa hoàn thành
    });
    return response.data;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Cập nhật trạng thái hoàn thành của công việc
const putCompleteTodo = async (id) => {
  try {
    // Lấy thông tin task hiện tại
    const todoFind = await api.get(`/todos/${id}`);
    const data = todoFind.data;
    
    // Cập nhật với trạng thái completed đảo ngược
    await api.put(`/todos/${id}`, {
      ...data, // Giữ nguyên các field khác
      completed: !data.completed, // Đảo ngược trạng thái completed
    });
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Cập nhật tiêu đề công việc
const putTitleTodo = async (id, newTitle) => {
  try {
    // Lấy thông tin task hiện tại
    const todoFind = await api.get(`/todos/${id}`);
    const data = todoFind.data;
    
    // Cập nhật với tiêu đề mới
    await api.put(`/todos/${id}`, {
      ...data, // Giữ nguyên các field khác
      title: newTitle, // Cập nhật tiêu đề mới
    });
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Xóa công việc
const deleteTodo = async (id) => {
  try {
    await api.delete(`/todos/${id}`);
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Hàm khởi tạo - tải và hiển thị danh sách công việc
const onMount = async () => {
  try {
    // Hiển thị loading khi đang tải
    showListLoading();

    // Gọi API lấy danh sách tasks
    const tasks = await getTodos();
    console.log(tasks); // Log để debug
    
    // Render tasks ra UI
    renderTasks(tasks);
  } catch (error) {
    console.log(error);
    // Hiển thị thông báo lỗi nếu không tải được
    taskList.innerHTML =
      '<li class="error-message">Error loading tasks. Please refresh the page.</li>';
  }
};

// Khởi chạy ứng dụng khi DOM đã load xong
document.addEventListener("DOMContentLoaded", () => onMount());