
import os

file_path = r'c:\Users\asus\Downloads\ats-hr-afrontend-develop\ats-hr-afrontend\src\App.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Import
old_import = 'import ResdexFolders from "./pages/recruiter/ResdexFolders";'
new_import = 'import ResdexFolders from "./pages/recruiter/ResdexFolders";\nimport AdvancedSearch from "./pages/recruiter/AdvancedSearch";'

if old_import in content:
    content = content.replace(old_import, new_import)
else:
    print("Warning: Import target not found, attempting fallback...")
    content = content.replace('import ResdexSendNVite from "./pages/recruiter/ResdexSendNVite";', 
                             'import ResdexSendNVite from "./pages/recruiter/ResdexSendNVite";\nimport AdvancedSearch from "./pages/recruiter/AdvancedSearch";')

# 2. Add Routes (Both locations)
route_snippet = """            <Route
              path="resdex/search-resumes"
              element={<ResdexSearchResumes />}
            />"""

new_route_snippet = """            <Route
              path="resdex/search-resumes"
              element={<ResdexSearchResumes />}
            />
            <Route
              path="resdex/advanced-search"
              element={<AdvancedSearch />}
            />"""

content = content.replace(route_snippet, new_route_snippet)

# Case 2 with slash
route_snippet_slash = """              <Route
                path="/recruiter/resdex/search-resumes"
                element={<ResdexSearchResumes />}
              />"""

new_route_snippet_slash = """              <Route
                path="/recruiter/resdex/search-resumes"
                element={<ResdexSearchResumes />}
              />
              <Route
                path="/recruiter/resdex/advanced-search"
                element={<AdvancedSearch />}
              />"""

content = content.replace(route_snippet_slash, new_route_snippet_slash)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully patched App.jsx")
