/* Copyright (c) 2022, VRAI Labs and/or its affiliates. All rights reserved.
 *
 * This software is licensed under the Apache License, Version 2.0 (the
 * "License") as published by the Apache Software Foundation.
 *
 * You may not use this file except in compliance with the License. You may
 * obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 */

import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import UsersListPage from "./ui/pages/usersList/UsersList";
import { getDashboardAppBasePath } from "./utils";

// This is to make sure that images are packed in the build folder
import "./images";
import ErrorBoundary from "./ui/components/errorboundary";
import { LayoutModalContainer } from "./ui/components/layout/layoutModal";
import SafeAreaView from "./ui/components/safeAreaView/SafeAreaView";
import { ToastNotificationContainer } from "./ui/components/toast/toastNotification";
import { PopupContentContextProvider } from "./ui/contexts/PopupContentContext";

function App() {
	return (
		<>
			<SafeAreaView />
			<ErrorBoundary>
				<PopupContentContextProvider>
					<>
						<Router basename={getDashboardAppBasePath()}>
							<Routes>
								<Route
									path="/"
									element={<UsersListPage />}
								/>
								<Route
									path="*"
									element={<UsersListPage />}
								/>
							</Routes>
						</Router>
						<ToastNotificationContainer />
						<LayoutModalContainer />
					</>
				</PopupContentContextProvider>
			</ErrorBoundary>
		</>
	);
}

export default App;
